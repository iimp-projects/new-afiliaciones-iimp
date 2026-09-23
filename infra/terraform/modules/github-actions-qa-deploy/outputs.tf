output "role_arn" {
  description = "ARN del rol que GitHub Actions debe asumir desde el environment qa."
  value       = aws_iam_role.github_actions_qa_deploy.arn
}

output "ssm_document_name" {
  description = "Nombre del documento SSM dedicado al deployment de la app QA."
  value       = aws_ssm_document.qa_deploy.name
}
