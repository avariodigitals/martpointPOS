export function generateSetupQuestions(product: string): string {
  const common = `1. Business registered name and CAC number (if applicable)
2. Business address and branch locations
3. Owner / Director full name and phone number
4. How many staff will use the system?
5. What devices will you use? (Android tablet, iPad, computer, phone)
6. Do you have a barcode scanner and receipt printer? (Yes/No)
7. Preferred go-live date`

  if (product === "erp") {
    return `${common}
8. How many warehouses or godowns do you operate?
9. Do you sell on credit to dealers? (Yes/No)
10. Do you need multi-branch transfer tracking? (Yes/No)
11. Who are your key suppliers? (Names)
12. Do you need API access to other systems? (Yes/No)`
  }

  return `${common}
8. What type of store do you run? (supermarket, mini mart, electronics, pharmacy, etc.)
9. Do you sell on credit to customers? (Yes/No)
10. Do you need weighing scale integration? (Yes/No)
11. Do you track expiry dates on products? (Yes/No)
12. How do you currently manage stock? (notebook, Excel, other software, none)`
}
