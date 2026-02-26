import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { ArrowLeft, CreditCard, Download, FileText } from 'lucide-react';

export function BillingSettings() {
  const { data: usage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.getUsage('current'),
  });

  const { data: invoices } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: billingApi.getInvoices,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link
              to="/dashboard"
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Usage */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Current Month Usage
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Your usage for the current billing period.
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Compute Hours
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {usage?.computeHours.toFixed(1) || '0'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Storage (GB)
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {usage?.storageGb.toFixed(1) || '0'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Network (GB)
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {usage?.networkGb.toFixed(1) || '0'}
                </dd>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <dt className="text-lg font-medium text-gray-900">
                  Total Cost
                </dt>
                <dd className="text-3xl font-bold text-indigo-600">
                  ${usage?.totalCost.toFixed(2) || '0.00'}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Payment Method
            </h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="flex items-center">
              <CreditCard className="h-12 w-12 text-gray-400 mr-4" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  No payment method on file
                </p>
                <p className="text-sm text-gray-500">
                  Add a payment method to continue using the service
                </p>
              </div>
              <button className="ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                Add Payment Method
              </button>
            </div>
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Invoice History
            </h3>
          </div>
          <div className="border-t border-gray-200">
            {invoices && invoices.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-indigo-600">
                            Invoice {invoice.id}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(invoice.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <p className="text-sm font-medium text-gray-900">
                          ${invoice.amount.toFixed(2)}
                        </p>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {invoice.status}
                        </span>
                        <button
                          className="text-indigo-600 hover:text-indigo-700"
                          title="Download"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>No invoices yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
