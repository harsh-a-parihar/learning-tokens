import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

export const getWallet = async (type: string, id: number) => {
    // Decrement id by 1 since the index starts from 0
    id = id - 1
    
    // Resolve base URL
    const rpcUrl = process.env.KALEIDO_HD_WALLET_RPC_URL || process.env.KALEIDO_RPC_URL
    if (!rpcUrl) {
        throw new Error('Kaleido RPC URL is missing. Check KALEIDO_HD_WALLET_RPC_URL or KALEIDO_RPC_URL.')
    }

    // Base template: ".../api/v1/wallets/:walletId/accounts/:accountIndex"
    const kaledioTemplate = rpcUrl.endsWith('/') 
        ? rpcUrl + 'api/v1/wallets/:walletId/accounts/:accountIndex'
        : rpcUrl + '/api/v1/wallets/:walletId/accounts/:accountIndex'

    let walletId = ''

    if (type === 'admin') {
        walletId = process.env.ADMIN_HD_WALLET_ID || process.env.SUPER_ADMIN_PUB_KEY || ''
    }
    if (type === 'institution') {
        walletId = process.env.INSTITUTION_HD_WALLET_ID || process.env.INSTITUTION_PUB_KEY || ''
    }
    if (type === 'instructor') {
        walletId = process.env.INSTRUCTOR_HD_WALLET_ID || process.env.INSTRUCTOR_PUB_KEY || ''
    }
    if (type === 'learner') {
        walletId = process.env.LEARNER_HD_WALLET_ID || process.env.LEARNER1_PUB_KEY || ''
    }

    if (!walletId) {
        console.error(`[Kaleido] Missing Wallet ID for type: ${type}`)
        throw new Error(`Wallet ID missing for type: ${type}`)
    }

    const url = kaledioTemplate
        .replace(':walletId', walletId)
        .replace(':accountIndex', id.toString())

    try {
        console.log(`[Kaleido] Fetching wallet for ${type} (ID: ${id})`)
        const result = await axios.get(url)
        console.log(`[Kaleido] Success:`, result.data)
        return result.data
    } catch (error: any) {
        console.error(`[Kaleido] Error fetching wallet: ${error.message}`)
        if (error.response) {
            console.error(`[Kaleido] Response data:`, error.response.data)
        }
        throw new Error(`Failed to fetch wallet for ${type}: ${error.message}`)
    }
}
