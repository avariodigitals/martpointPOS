import { notFound } from "next/navigation"
import { getReceiptByNumber } from "@/lib/receipt"

export default async function ReceiptPage({ params }: { params: any }) {
  const { receiptNumber } = await params
  const receipt = await getReceiptByNumber(receiptNumber)
  if (!receipt) notFound()

  return (
    <div className="min-h-screen bg-white p-8 max-w-3xl mx-auto">
      <div className="border border-gray-200 rounded-lg p-8 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MartPoint</h1>
            <p className="text-sm text-gray-500">Receipt</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Receipt Number</p>
            <p className="text-lg font-semibold text-gray-900">{receipt.receiptNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-1">Customer</p>
            <p className="font-medium text-gray-900">{receipt.businessName}</p>
            {receipt.businessEmail && <p className="text-sm text-gray-600">{receipt.businessEmail}</p>}
            {receipt.businessPhone && <p className="text-sm text-gray-600">{receipt.businessPhone}</p>}
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Payment Details</p>
            <p className="text-sm text-gray-700"><span className="text-gray-500">Invoice:</span> {receipt.invoiceNumber}</p>
            <p className="text-sm text-gray-700"><span className="text-gray-500">Reference:</span> {receipt.paymentReference}</p>
            <p className="text-sm text-gray-700"><span className="text-gray-500">Method:</span> {receipt.paymentMethod}</p>
            <p className="text-sm text-gray-700"><span className="text-gray-500">Date:</span> {new Date(receipt.paymentDate).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Amount Paid</p>
              <p className="text-3xl font-bold text-gray-900">{(receipt.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} {receipt.currency}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-lg font-semibold text-green-600">Paid</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          This is an official receipt from MartPoint. No internal notes are displayed.
        </div>
      </div>
    </div>
  )
}
