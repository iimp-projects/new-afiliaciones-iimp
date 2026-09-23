resource "aws_ecs_cluster" "this" {
  name = "${var.resource_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-cluster"
  })
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.resource_prefix}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for name, value in var.environment_variables : {
          name  = name
          value = value
        }
      ]

      secrets = [
        for name, arn in var.secret_environment : {
          name      = name
          valueFrom = arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "app"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'${var.health_check_path}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 20
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-app"
  })
}

# Tarea one-shot de migración (NO es un servicio): se ejecuta explícitamente
# antes del rollout web. Nunca se ejecuta automáticamente al arrancar cada tarea.
resource "aws_ecs_task_definition" "migration" {
  # count solo con valores conocidos en plan (la imagen es un input conocido).
  count = var.migration_image != null ? 1 : 0

  family                   = "${var.resource_prefix}-migration"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.migration_role_arn
  task_role_arn            = var.migration_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([
    {
      name      = "migration"
      image     = var.migration_image
      essential = true
      command   = ["npx", "prisma", "migrate", "deploy"]

      environment = [
        for name, value in var.environment_variables : {
          name  = name
          value = value
        }
      ]

      secrets = [
        for name, arn in var.secret_environment : {
          name      = name
          valueFrom = arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "migration"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-migration"
  })
}

resource "aws_ecs_service" "app" {
  name            = "${var.resource_prefix}-service"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  platform_version = "LATEST"

  network_configuration {
    subnets          = var.private_app_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "app"
    container_port   = var.container_port
  }

  health_check_grace_period_seconds = 60

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = var.enable_execute_command

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-service"
  })
}
