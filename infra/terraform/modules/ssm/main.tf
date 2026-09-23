data "aws_caller_identity" "current" {}

# Parámetros NO sensibles (configuración). Los valores provienen de variables.
resource "aws_ssm_parameter" "this" {
  for_each = var.parameters

  name  = "${var.parameter_namespace}/${each.key}"
  type  = "String"
  value = each.value

  tags = merge(var.tags, {
    Name = "${var.parameter_namespace}/${each.key}"
  })
}

# Los parámetros SecureString (secretos) NO se crean en Terraform: sus valores se
# cargan fuera del repositorio. Solo se derivan sus ARNs para la política IAM.
locals {
  secure_parameter_arns = [
    for name in var.secure_parameter_names :
    "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.parameter_namespace}/${name}"
  ]
}
