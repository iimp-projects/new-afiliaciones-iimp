resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-github-actions-oidc"
  })
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    sid     = "GitHubActionsQaEnvironmentOnly"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [var.github_oidc_subject]
    }
  }
}

resource "aws_iam_role" "github_actions_qa_deploy" {
  name                 = "${var.resource_prefix}-github-actions-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_actions_assume.json
  max_session_duration = 3600

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-github-actions-deploy"
  })
}

resource "aws_ssm_document" "qa_deploy" {
  name            = "AfiliacionesQaDeploy"
  document_type   = "Command"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Deploy an approved immutable afiliaciones QA image to the app service only"
    parameters = {
      ImageUri = {
        type              = "String"
        description       = "Immutable QA image URI produced by the approved GitHub Actions workflow"
        interpolationType = "ENV_VAR"
        allowedPattern    = "^${replace(var.ecr_repository_url, ".", "\\.")}:qa-[0-9a-f]{40}-[0-9]+-[0-9]+$"
      }
    }
    mainSteps = [
      {
        action = "aws:runShellScript"
        name   = "deployQaApp"
        inputs = {
          timeoutSeconds = "900"
          runCommand = [
            "set -Eeuo pipefail",
            "cd /opt/afiliaciones-qa",
            "new_image=\"$SSM_ImageUri\"",
            "expected_prefix='${var.ecr_repository_url}:qa-'",
            "case \"$new_image\" in \"$expected_prefix\"*) ;; *) echo 'Rejected IMAGE_URI.' >&2; exit 2 ;; esac",
            "region='${var.aws_region}'",
            "registry='${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com'",
            "compose_base='docker-compose.yml'",
            "compose_override='.qa-app-image.override.yml'",
            "app_container=\"$(docker compose -f \"$compose_base\" -f \"$compose_override\" ps -q app 2>/dev/null || docker compose -f \"$compose_base\" ps -q app)\"",
            "test -n \"$app_container\"",
            "previous_image=\"$(docker inspect \"$app_container\" | jq -er '.[0].Config.Image')\"",
            "test -n \"$previous_image\"",
            "write_override() { printf 'services:\\n  app:\\n    image: \"%s\"\\n' \"$1\" > \"$compose_override\"; }",
            "wait_for_app_health() { for attempt in $(seq 1 60); do current_container=\"$(docker compose -f \"$compose_base\" -f \"$compose_override\" ps -q app)\"; if [ -n \"$current_container\" ]; then health=\"$(docker inspect \"$current_container\" | jq -er '.[0] | if .State.Health then .State.Health.Status else .State.Status end')\"; [ \"$health\" = healthy ] && return 0; [ \"$health\" = unhealthy ] && return 1; fi; sleep 5; done; return 1; }",
            "rollback_app() { exit_code=$?; trap - ERR; echo 'QA app rollout failed; restoring the previously active image.'; write_override \"$previous_image\"; docker compose -f \"$compose_base\" -f \"$compose_override\" up -d --no-deps --force-recreate app; wait_for_app_health || echo 'Rollback app health could not be confirmed.'; exit \"$exit_code\"; }",
            "trap rollback_app ERR",
            "aws ecr get-login-password --region \"$region\" | docker login --username AWS --password-stdin \"$registry\" >/dev/null",
            "docker pull \"$new_image\"",
            "write_override \"$new_image\"",
            "docker compose -f \"$compose_base\" -f \"$compose_override\" up -d --no-deps --force-recreate app",
            "wait_for_app_health",
            "deployed_container=\"$(docker compose -f \"$compose_base\" -f \"$compose_override\" ps -q app)\"",
            "deployed_image=\"$(docker inspect \"$deployed_container\" | jq -er '.[0].Config.Image')\"",
            "test \"$deployed_image\" = \"$new_image\"",
            "curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 '${var.qa_base_url}/api/health/live' >/dev/null",
            "curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 '${var.qa_base_url}/api/health/ready' >/dev/null",
            "curl --fail --silent --show-error --retry 6 --retry-all-errors --retry-delay 5 '${var.qa_base_url}/login' >/dev/null",
            "curl --fail --silent --show-error --retry 6 --retry-all-errors --retry-delay 5 '${var.qa_base_url}/consulta' >/dev/null",
            "trap - ERR",
            "echo 'QA app deployment and HTTP smoke tests completed.'"
          ]
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "AfiliacionesQaDeploy"
  })
}

data "aws_iam_policy_document" "github_actions_qa_deploy" {
  statement {
    sid       = "AuthenticateToEcrInQaRegion"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }
  }

  statement {
    sid    = "PushAndInspectOnlyQaApplicationRepository"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid     = "SendOnlyDedicatedDocumentToExactQaInstance"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_ssm_document.qa_deploy.arn,
      var.qa_instance_arn,
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }
  }

  statement {
    sid       = "ReadCommandInvocationResultInQaRegion"
    effect    = "Allow"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }
  }
}

resource "aws_iam_role_policy" "github_actions_qa_deploy" {
  name   = "${var.resource_prefix}-github-actions-deploy"
  role   = aws_iam_role.github_actions_qa_deploy.id
  policy = data.aws_iam_policy_document.github_actions_qa_deploy.json
}
