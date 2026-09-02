/**
 * Payment System Marketplace - Version Front-end
 * Utilise les SDK Stripe.js et Flutterwave.js côté client
 * 
 * Rôle: Gérer les paiements pour le marketplace de templates
 * - Stripe (cartes bancaires)
 * - Flutterwave (M-Pesa, Airtel, Orange, cartes africaines)
 * - Interface unifiée pour tous les paiements
 */

import { EventEmitter } from 'events'
import { loadStripe } from '@stripe/stripe-js' // ✅ Version navigateur
import { crypto } from '../../utils/crypto'

// =============================
// CONFIGURATION
// =============================

export const PAYMENT_METHODS = {
  STRIPE: 'stripe',           // Cartes bancaires
  MPESA: 'mpesa',             // M-Pesa (Kenya, Tanzanie)
  AIRTEL: 'airtel',           // Airtel Money (Afrique)
  ORANGE: 'orange',           // Orange Money (Afrique)
  CARD_AFRICA: 'card_africa'  // Cartes via Flutterwave
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
}

export const CURRENCIES = {
  USD: 'USD',
  EUR: 'EUR',
  KES: 'KES', // Kenya Shilling
  TZS: 'TZS', // Tanzania Shilling
  UGX: 'UGX', // Uganda Shilling
  XAF: 'XAF', // CFA Franc BEAC
  XOF: 'XOF', // CFA Franc BCEAO
  GHS: 'GHS'  // Ghana Cedi
}

// =============================
// UTILITAIRES DE VALIDATION
// =============================

const validatePhone = (phone, country) => {
  if (!phone) return false

  const patterns = {
    KENYA: /^(254|0)[17]\d{8}$/,
    TANZANIA: /^(255|0)[67]\d{8}$/,
    UGANDA: /^(256|0)[7]\d{8}$/,
    GHANA: /^(233|0)[2]\d{8}$/,
    DEFAULT: /^\d{10,15}$/
  }

  const pattern = patterns[country] || patterns.DEFAULT
  return pattern.test(phone.replace(/\s+/g, ''))
}

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

const validateAmount = (amount, currency) => {
  if (!amount || amount <= 0) return false

  const decimals = {
    USD: 2, EUR: 2,
    KES: 0, TZS: 0, UGX: 0, XAF: 0, XOF: 0,
    GHS: 2
  }

  const decimalPlaces = decimals[currency] || 2
  const multiplier = Math.pow(10, decimalPlaces)
  const rounded = Math.round(amount * multiplier)

  return Math.abs(rounded - amount * multiplier) < 0.0001
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class TemplatePayment extends EventEmitter {
  constructor(config = {}) {
    super()

    this.transactions = new Map()
    this.stripe = null
    this.stripePublishableKey = config.stripePublishableKey
    this.flutterwavePublicKey = config.flutterwavePublicKey
    this.apiBaseUrl = config.apiBaseUrl || '/api' // URL de ton back-end
    this.commissionRate = config.commissionRate || 0.1
  }

  /**
   * Initialisation (côté client)
   */
  async initialize() {
    try {
      // Initialiser Stripe si la clé est fournie
      if (this.stripePublishableKey) {
        this.stripe = await loadStripe(this.stripePublishableKey)
        console.log('✅ Stripe initialisé')
      }

      // Vérifier que Flutterwave est chargé
      if (this.flutterwavePublicKey && !window.FlutterwaveCheckout) {
        await this._loadFlutterwaveScript()
      }

      console.log('✅ Payment system ready (front-end)')
      this.emit('initialized')

    } catch (error) {
      console.error('❌ Payment system initialization failed:', error)
      throw error
    }
  }

  /**
   * Charge le script Flutterwave dynamiquement
   */
  _loadFlutterwaveScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.flutterwave.com/v3.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  /**
   * Point d'entrée unique pour tous les paiements
   */
  async processPayment(data) {
    const {
      amount,
      currency = 'USD',
      method,
      email,
      phone,
      name,
      templateId,
      templateName,
      userId,
      sellerId
    } = data

    // 1. Validation
    this._validatePaymentData(data)

    // 2. Créer la transaction côté serveur
    const transaction = await this._createTransaction({
      amount,
      currency,
      method,
      templateId,
      userId,
      sellerId
    })

    // 3. Traiter selon la méthode
    let result

    try {
      switch (method) {
        case PAYMENT_METHODS.STRIPE:
          result = await this._processStripePayment({
            ...data,
            transactionId: transaction.id
          })
          break

        case PAYMENT_METHODS.MPESA:
        case PAYMENT_METHODS.AIRTEL:
        case PAYMENT_METHODS.ORANGE:
        case PAYMENT_METHODS.CARD_AFRICA:
          result = await this._processFlutterwavePayment({
            ...data,
            transactionId: transaction.id
          })
          break

        default:
          throw new Error(`Méthode non supportée: ${method}`)
      }

      // 4. Mettre à jour le statut
      await this._updateTransactionStatus(transaction.id, {
        status: PAYMENT_STATUS.COMPLETED,
        paymentId: result.paymentId
      })

      this.emit('payment:completed', { transaction, result })

      return {
        success: true,
        transaction,
        paymentId: result.paymentId
      }

    } catch (error) {
      await this._updateTransactionStatus(transaction.id, {
        status: PAYMENT_STATUS.FAILED,
        error: error.message
      })

      this.emit('payment:failed', { transaction, error })
      throw error
    }
  }

  /**
   * Paiement Stripe
   */
  async _processStripePayment(data) {
    const {
      amount,
      currency,
      description,
      transactionId,
      email,
      metadata = {}
    } = data

    if (!this.stripe) {
      throw new Error('Stripe non configuré')
    }

    // 1. Créer le PaymentIntent côté serveur
    const response = await fetch(`${this.apiBaseUrl}/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency,
        description,
        transactionId,
        metadata
      })
    })

    const { clientSecret, error: serverError } = await response.json()

    if (serverError) {
      throw new Error(serverError)
    }

    // 2. Confirmer le paiement côté client
    const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret)

    if (error) {
      throw new Error(error.message)
    }

    return {
      success: true,
      paymentId: paymentIntent.id
    }
  }

  /**
   * Paiement Flutterwave
   */
  async _processFlutterwavePayment(data) {
    const {
      amount,
      currency,
      email,
      phone,
      name,
      transactionId,
      templateName
    } = data

    if (!window.FlutterwaveCheckout) {
      throw new Error('Flutterwave non chargé')
    }

    return new Promise((resolve, reject) => {
      const config = {
        public_key: this.flutterwavePublicKey,
        tx_ref: transactionId,
        amount,
        currency,
        payment_options: this._getPaymentOptions(data.method),
        customer: {
          email,
          phone_number: phone,
          name
        },
        customizations: {
          title: 'Vibe-Coding',
          description: `Achat: ${templateName || 'Template'}`
        },
        meta: {
          transactionId,
          method: data.method
        },
        callback: (response) => {
          if (response.status === 'successful') {
            resolve({
              success: true,
              paymentId: response.transaction_id
            })
          } else {
            reject(new Error('Paiement échoué'))
          }
        },
        onclose: () => {
          reject(new Error('Paiement annulé'))
        }
      }

      window.FlutterwaveCheckout(config)
    })
  }

  /**
   * Options de paiement selon la méthode
   */
  _getPaymentOptions(method) {
    const options = {
      [PAYMENT_METHODS.MPESA]: 'mobilemoney',
      [PAYMENT_METHODS.AIRTEL]: 'mobilemoney',
      [PAYMENT_METHODS.ORANGE]: 'mobilemoney',
      [PAYMENT_METHODS.CARD_AFRICA]: 'card'
    }

    return options[method] || 'card,mobilemoney'
  }

  /**
   * Crée une transaction côté serveur
   */
  async _createTransaction(data) {
    const response = await fetch(`${this.apiBaseUrl}/create-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    const transaction = await response.json()

    if (!transaction.id) {
      throw new Error('Erreur création transaction')
    }

    this.transactions.set(transaction.id, transaction)
    return transaction
  }

  /**
   * Met à jour le statut d'une transaction
   */
  async _updateTransactionStatus(transactionId, updates) {
    const transaction = this.transactions.get(transactionId)
    if (transaction) {
      Object.assign(transaction, updates)
    }

    await fetch(`${this.apiBaseUrl}/update-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, ...updates })
    })
  }

  /**
   * Validation des données de paiement
   */
  _validatePaymentData(data) {
    const errors = []

    // Montant
    if (!validateAmount(data.amount, data.currency)) {
      errors.push('Montant invalide')
    }

    // Devise
    if (!Object.values(CURRENCIES).includes(data.currency)) {
      errors.push(`Devise non supportée: ${data.currency}`)
    }

    // Email
    if (!validateEmail(data.email)) {
      errors.push('Email invalide')
    }

    // Téléphone pour mobile money
    if ([PAYMENT_METHODS.MPESA, PAYMENT_METHODS.AIRTEL, PAYMENT_METHODS.ORANGE]
        .includes(data.method)) {
      
      if (!data.phone) {
        errors.push('Téléphone requis pour le mobile money')
      }

      const country = this._getCountryFromCurrency(data.currency)
      if (!validatePhone(data.phone, country)) {
        errors.push('Format de téléphone invalide')
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation échouée: ${errors.join(', ')}`)
    }
  }

  /**
   * Détermine le pays depuis la devise
   */
  _getCountryFromCurrency(currency) {
    const map = {
      KES: 'KENYA',
      TZS: 'TANZANIA',
      UGX: 'UGANDA',
      GHS: 'GHANA'
    }
    return map[currency] || 'DEFAULT'
  }

  /**
   * Vérifie le statut d'un paiement
   */
  async checkPaymentStatus(paymentId) {
    const response = await fetch(`${this.apiBaseUrl}/payment-status/${paymentId}`)
    return response.json()
  }

  /**
   * Récupère une transaction
   */
  getTransaction(transactionId) {
    return this.transactions.get(transactionId) || null
  }

  /**
   * Récupère les transactions d'un utilisateur
   */
  async getUserTransactions(userId) {
    const response = await fetch(`${this.apiBaseUrl}/user-transactions/${userId}`)
    return response.json()
  }

  /**
   * Remboursement
   */
  async refund(transactionId) {
    const response = await fetch(`${this.apiBaseUrl}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId })
    })

    const result = await response.json()

    if (result.success) {
      const transaction = this.transactions.get(transactionId)
      if (transaction) {
        transaction.status = PAYMENT_STATUS.REFUNDED
      }
      this.emit('payment:refunded', { transactionId })
    }

    return result
  }

  /**
   * Statistiques
   */
  async getStats() {
    const response = await fetch(`${this.apiBaseUrl}/payment-stats`)
    return response.json()
  }
}

// =============================
// EXPORT
// =============================

export const templatePayment = new TemplatePayment()
export default templatePayment
