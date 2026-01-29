
import { PrismaClient } from '@prisma/client'

async function main() {
    const prisma = new PrismaClient()
    try {
        const settings = await prisma.settings.findMany()
        console.log("--- SETTINGS TABLE CONTENT ---")
        settings.forEach(s => {
            console.log(`Tenant: ${s.tenantId} | Bot: ${s.telegramBotToken ? 'EXISTS' : 'EMPTY'} | Group: ${s.telegramGroupId} | Owner: ${s.telegramOwnerChatId}`)
        })

        const tenants = await prisma.tenant.findMany()
        console.log("\n--- TENANTS TABLE CONTENT ---")
        tenants.forEach(t => {
            console.log(`ID: ${t.id} | Name: ${t.name}`)
        })
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
