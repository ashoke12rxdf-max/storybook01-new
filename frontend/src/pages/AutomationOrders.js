import { useState, useEffect, useCallback } from 'react';
import { Package, RefreshCw, ExternalLink, AlertCircle, CheckCircle, Clock, XCircle, TestTube, Mail, MailX } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function AutomationOrders({ standalone = true }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    try {
      const url = statusFilter === 'all' 
        ? `${API_URL}/api/automation/orders`
        : `${API_URL}/api/automation/orders?status=${statusFilter}`;
      const response = await fetch(url);
      const data = await response.json();
      setOrders(data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const retryOrder = async (orderId) => {
    try {
      const response = await fetch(`${API_URL}/api/automation/orders/${orderId}/retry`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Retry failed');
      }

      toast.success('Order retry initiated');
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        const updatedOrder = await fetchOrderDetails(orderId);
        setSelectedOrder(updatedOrder);
      }
    } catch (error) {
      console.error('Retry failed:', error);
      toast.error(error.message);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    try {
      const response = await fetch(`${API_URL}/api/automation/orders/${orderId}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      return null;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="text-green-600" size={20} />;
      case 'failed': return <XCircle className="text-red-600" size={20} />;
      case 'processing': return <Clock className="text-blue-600" size={20} />;
      default: return <Clock className="text-gray-600" size={20} />;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      received: 'bg-gray-100 text-gray-800 border-gray-200',
      verified: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[status] || colors.received;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header - only show if standalone */}
      {standalone && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Automation Orders</h1>
            </div>
            <button
              onClick={() => setShowSimulator(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <TestTube size={20} />
              Test Webhook
            </button>
          </div>
        </div>
      )}

      {/* Header for embedded mode */}
      {!standalone && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Automation Orders</h1>
            <button
              onClick={() => setShowSimulator(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <TestTube size={20} />
              Test Webhook
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2">
          {['all', 'completed', 'failed', 'processing'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status === 'all' ? 'All Orders' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No orders yet</p>
            <p className="text-gray-500 text-sm mt-2">Test the webhook simulator to create an order</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onViewDetails={async (o) => {
                  const details = await fetchOrderDetails(o.id);
                  setSelectedOrder(details);
                }}
                onRetry={retryOrder}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRetry={retryOrder}
          getStatusBadge={getStatusBadge}
        />
      )}

      {/* Webhook Simulator Modal */}
      {showSimulator && (
        <WebhookSimulatorModal
          onClose={() => setShowSimulator(false)}
          onSuccess={() => {
            fetchOrders();
            setShowSimulator(false);
          }}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onViewDetails, onRetry, getStatusIcon, getStatusBadge }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {order.isSimulatedWebhook && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded border border-yellow-300">
                TEST
              </span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              {order.customerData?.requestedName || 'Unknown'}'s Order
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(order.status)}`}>
              {order.status.toUpperCase()}
            </span>
            
            {/* Email Status Icon */}
            {order.status === 'completed' && (
              order.emailSent ? (
                <span className="flex items-center gap-1 text-green-600" title="Email delivered">
                  <Mail size={18} />
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600" title="Email failed">
                  <MailX size={18} />
                </span>
              )
            )}
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            <p>
              Product: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{order.productSlug}</span>
            </p>
            <p>Email: {order.customerData?.customerEmail}</p>
            <p>Order ID: <span className="font-mono text-xs">{order.externalOrderId}</span></p>
            {order.customerViewUrl && (
              <a
                href={order.customerViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700"
              >
                View Storybook <ExternalLink size={14} />
              </a>
            )}
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Created: {new Date(order.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(order)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            View Details
          </button>
          {order.status === 'failed' && !order.finalizedAt && (
            <button
              onClick={() => onRetry(order.id)}
              className="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors flex items-center gap-1"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderDetailsModal({ order, onClose, onRetry, getStatusBadge }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <p className="text-sm text-gray-600 mt-1">{order.externalOrderId}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadge(order.status)}`}>
              {order.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Customer Info */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p><strong>Requested Name:</strong> {order.customerData?.requestedName}</p>
              <p><strong>Buyer Name:</strong> {order.customerData?.buyerFullName}</p>
              <p><strong>Email:</strong> {order.customerData?.customerEmail}</p>
              {order.customerData?.password && (
                <p><strong>Password:</strong> Protected ✓</p>
              )}
              {order.isSimulatedWebhook && (
                <p className="text-yellow-700 font-semibold">⚠️ TEST ORDER (Simulated Webhook)</p>
              )}
            </div>
          </div>

          {/* Template Info */}
          {order.templateSnapshot && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Template Used</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><strong>Title:</strong> {order.templateSnapshot.title}</p>
                <p><strong>Product:</strong> {order.templateSnapshot.productSlug}</p>
                <p><strong>Fields Mapped:</strong> {order.templateSnapshot.fieldMappings?.length || 0}</p>
              </div>
            </div>
          )}

          {/* Generated Assets */}
          {order.status === 'completed' && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Generated Assets</h3>
              <div className="bg-green-50 rounded-lg p-4 space-y-2 text-sm">
                <p><strong>Storybook ID:</strong> <span className="font-mono text-xs">{order.storybookId}</span></p>
                <p><strong>Slug:</strong> <span className="font-mono text-xs">{order.storybookSlug}</span></p>
                {order.customerViewUrl && (
                  <a
                    href={order.customerViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    View Customer Storybook <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Email Delivery Status */}
          {order.status === 'completed' && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Email Delivery</h3>
              <div className={`rounded-lg p-4 space-y-2 text-sm ${
                order.emailSent ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <p className="flex items-center gap-2">
                  {order.emailSent ? (
                    <>
                      <Mail className="text-green-600" size={18} />
                      <strong className="text-green-900">Email Sent: Yes</strong>
                    </>
                  ) : (
                    <>
                      <MailX className="text-red-600" size={18} />
                      <strong className="text-red-900">Email Sent: No (Failed)</strong>
                    </>
                  )}
                </p>
                {order.emailSentAt && (
                  <p><strong>Sent At:</strong> {new Date(order.emailSentAt).toLocaleString()}</p>
                )}
                <p><strong>Sent To:</strong> {order.customerData?.customerEmail}</p>
              </div>
            </div>
          )}

          {/* Error Info */}
          {order.status === 'failed' && order.errorMessage && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-red-900 mb-3">Error Information</h3>
              <div className="bg-red-50 rounded-lg p-4 space-y-2 text-sm">
                <p className="text-red-900"><strong>Error:</strong> {order.errorMessage}</p>
                {order.retryCount > 0 && (
                  <p className="text-red-700">Retry attempts: {order.retryCount}</p>
                )}
              </div>
            </div>
          )}

          {/* Processing Timeline */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing Timeline</h3>
            <div className="space-y-3">
              {order.processingLog?.map((log, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${
                      log.status === 'completed' ? 'bg-green-500' :
                      log.status === 'failed' ? 'bg-red-500' :
                      log.status === 'processing' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`} />
                    {idx < order.processingLog.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium text-gray-900">{log.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div>
            {order.status === 'failed' && !order.finalizedAt && (
              <button
                onClick={() => {
                  onRetry(order.id);
                  onClose();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Retry Order
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function WebhookSimulatorModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    productSlug: '',
    requestedName: '',
    customerEmail: '',
    password: '',
    orderId: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/automation/simulate-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.order?.errorMessage || 'Simulation failed');
      }

      toast.success('Webhook processed successfully!');
      onSuccess();
    } catch (error) {
      console.error('Simulation failed:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Webhook Simulator</h2>
          <p className="text-sm text-gray-600 mt-1">Test automation without real payments</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Slug *
            </label>
            <input
              type="text"
              required
              value={formData.productSlug}
              onChange={(e) => setFormData({...formData, productSlug: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., lunas-adventure"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requested Name *
            </label>
            <input
              type="text"
              required
              value={formData.requestedName}
              onChange={(e) => setFormData({...formData, requestedName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Emma"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Email *
            </label>
            <input
              type="email"
              required
              value={formData.customerEmail}
              onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="test@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password (optional)
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="For password protection"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order ID (optional)
            </label>
            <input
              type="text"
              value={formData.orderId}
              onChange={(e) => setFormData({...formData, orderId: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Auto-generated if empty"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Simulate Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AutomationOrders;