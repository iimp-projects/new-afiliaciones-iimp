// ESTO ES LO QUE DEBES USAR:
import "dotenv/config";
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

// Prisma 7 exige crear un adaptador e inyectarlo en el cliente
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string })
const prisma = new PrismaClient({ adapter })
async function main() {
  console.log('🌱 Iniciando la siembra de datos (Seeder)...')

  // =========================================================
  // 1. CREACIÓN DE PERMISOS GRANULARES
  // =========================================================
  const permissionsData = [
    // Permisos Globales
    { action: 'manage', subject: 'all', description: 'Control total del sistema' },
    
    // Permisos de Expedientes (Postulaciones)
    { action: 'read', subject: 'Expedientes', description: 'Ver lista y detalle de expedientes' },
    { action: 'update', subject: 'Expedientes', description: 'Aprobar o rechazar expedientes' },
    
    // Permisos Legales
    { action: 'validate', subject: 'Legal', description: 'Validar declaraciones juradas y antecedentes' },
    
    // Permisos de Pagos
    { action: 'read', subject: 'Pagos', description: 'Ver historial de pagos y cuotas' },
    { action: 'validate', subject: 'Pagos', description: 'Aprobar vouchers y transferencias' },
    
    // Permisos de Comunicaciones
    { action: 'publish', subject: 'Comunicaciones', description: 'Enviar comunicados a los asociados' },
    
    // Permisos de Usuario Final (Perfil propio)
    { action: 'read', subject: 'MiPerfil', description: 'Ver su propia información' },
    { action: 'update', subject: 'MiPerfil', description: 'Actualizar sus propios datos' },
    { action: 'pay', subject: 'MisCuotas', description: 'Pagar sus propias cuotas' },
  ]

  const createdPermissions = []
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { action_subject: { action: p.action, subject: p.subject } },
      update: {},
      create: p,
    })
    createdPermissions.push(perm)
  }
  console.log('✅ Permisos creados')

  // =========================================================
  // 2. CREACIÓN DE ROLES
  // =========================================================
  const rolesData = [
    { name: 'Super Administrador', slug: 'SUPER_ADMIN', description: 'Acceso total al sistema IIMP' },
    { name: 'Logística y Operaciones', slug: 'LOGISTICA', description: 'Revisión y validación de expedientes y pagos' },
    { name: 'Asesoría Legal', slug: 'LEGAL', description: 'Revisión de normativas y declaraciones juradas' },
    { name: 'Comunicaciones', slug: 'COMUNICACIONES', description: 'Gestión de correos y anuncios a asociados' },
    { name: 'Postulante', slug: 'POSTULANTE', description: 'Usuario que está llenando su ficha de inscripción' },
    { name: 'Asociado Activo', slug: 'ASOCIADO_ACTIVO', description: 'Miembro regular del IIMP con cuotas al día' },
    { name: 'Asociado Estudiante', slug: 'ASOCIADO_ESTUDIANTE', description: 'Estudiante de pregrado afiliado al IIMP' },
  ]

  for (const r of rolesData) {
    await prisma.role.upsert({
      where: { slug: r.slug },
      update: { description: r.description },
      create: r,
    })
  }
  console.log('✅ Roles creados')

  // =========================================================
  // 3. ASIGNACIÓN DE PERMISOS A LOS ROLES
  // =========================================================
  // Función helper para buscar IDs fácilmente
  const getRole = async (slug: string) => await prisma.role.findUnique({ where: { slug } })
  const getPerm = async (action: string, subject: string) => 
    await prisma.permission.findUnique({ where: { action_subject: { action, subject } } })

  const rolePermissionsMap = [
    // Logística ve expedientes y valida pagos
    { roleSlug: 'LOGISTICA', perms: [
        { action: 'read', subject: 'Expedientes' },
        { action: 'update', subject: 'Expedientes' },
        { action: 'read', subject: 'Pagos' },
        { action: 'validate', subject: 'Pagos' },
      ]
    },
    // Legal ve expedientes y valida la parte legal
    { roleSlug: 'LEGAL', perms: [
        { action: 'read', subject: 'Expedientes' },
        { action: 'validate', subject: 'Legal' },
      ]
    },
    // Comunicaciones manda correos
    { roleSlug: 'COMUNICACIONES', perms: [
        { action: 'read', subject: 'Expedientes' },
        { action: 'publish', subject: 'Comunicaciones' },
      ]
    },
    // Todos los usuarios finales pueden ver y editar su propio perfil
    { roleSlug: 'POSTULANTE', perms: [{ action: 'read', subject: 'MiPerfil' }, { action: 'update', subject: 'MiPerfil' }] },
    { roleSlug: 'ASOCIADO_ACTIVO', perms: [{ action: 'read', subject: 'MiPerfil' }, { action: 'update', subject: 'MiPerfil' }, { action: 'pay', subject: 'MisCuotas' }] },
    { roleSlug: 'ASOCIADO_ESTUDIANTE', perms: [{ action: 'read', subject: 'MiPerfil' }, { action: 'update', subject: 'MiPerfil' }] },
  ]

  for (const mapping of rolePermissionsMap) {
    const role = await getRole(mapping.roleSlug)
    if (!role) continue

    for (const p of mapping.perms) {
      const perm = await getPerm(p.action, p.subject)
      if (!perm) continue

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      })
    }
  }
  // Al Super Admin no le asignamos permisos en la tabla puente porque su slug "SUPER_ADMIN" 
  // le dará bypass automático en la lógica del código a todo.
  console.log('✅ Permisos enlazados a los roles correspondientes')

  // =========================================================
  // 4. CREACIÓN DE USUARIOS DE PRUEBA
  // =========================================================
  const defaultPassword = await bcrypt.hash('Iimp2026*', 10)

  const usersData = [
    { email: 'admin@iimp.org.pe', roleSlug: 'SUPER_ADMIN' },
    { email: 'logistica@iimp.org.pe', roleSlug: 'LOGISTICA' },
    { email: 'legal@iimp.org.pe', roleSlug: 'LEGAL' },
    { email: 'comunicaciones@iimp.org.pe', roleSlug: 'COMUNICACIONES' },
    { email: 'juan.postulante@gmail.com', roleSlug: 'POSTULANTE' },
    { email: 'carlos.asociado@gmail.com', roleSlug: 'ASOCIADO_ACTIVO' },
    { email: 'maria.estudiante@universidad.edu.pe', roleSlug: 'ASOCIADO_ESTUDIANTE' },
  ]

  for (const u of usersData) {
    const role = await getRole(u.roleSlug)
    if (!role) continue

    await prisma.user.upsert({
      where: { email: u.email },
      update: { roleId: role.id },
      create: {
        email: u.email,
        password: defaultPassword,
        roleId: role.id,
        isActive: true,
      },
    })
  }
  console.log('✅ 7 Usuarios de prueba generados')
  console.log('🎉 Seeder ejecutado con éxito.')
}

main()
  .catch((e) => {
    console.error('❌ Error en el seeder:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })