export function generateSetupQuestions(product: string): string {
  const common = `1. Branding — brand/store name, logo, and preferred account name
2. Business & contact — registered name, store phone/email, and full address
3. Users — primary admin plus staff logins (name, email, phone, role)
4. Branches — locations, addresses, and phone numbers
5. Banking & tax — bank account details, VAT status, tax rate, TIN
6. Online payments — preferred vendor (Paystack, Flutterwave, etc.)
7. Shipping — delivery arrangement, zones, and fees
8. Data & hardware — product import status and available devices
9. Preferred go-live date`

  if (product === "erp") {
    return `${common}
10. How many warehouses or godowns do you operate?
11. Do you sell on credit to dealers? (Yes/No)
12. Do you need multi-branch transfer tracking? (Yes/No)
13. Do you need API access to other systems? (Yes/No)`
  }

  return `${common}
10. What type of store do you run? (supermarket, mini mart, electronics, pharmacy, etc.)
11. Do you sell on credit to customers? (Yes/No)
12. Do you need weighing scale integration? (Yes/No)
13. Do you track expiry dates on products? (Yes/No)`
}
