import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../services/api';
import { useAuth } from '../auth/useAuth';
import AdminProvisionWallet from './AdminProvisionWallet';
import AdminMarketAnalytics from './AdminMarketAnalytics';
import Icon from './Icon';

function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [webhookForm, setWebhookForm] = useState({
    url: '',
    secret: '',
    events: 'transaction.confirmed,transaction.failed,transaction.reorged',
    isActive: true
  });
  const [editingWebhookId, setEditingWebhookId] = useState(null);
  const [webhookMessage, setWebhookMessage] = useState('');
  const [pendingKyc, setPendingKyc] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overview':
          const statsRes = await adminAPI.getStats();
          setStats(statsRes.data);
          break;
        case 'users':
          const usersRes = await adminAPI.getUsers({ page: currentPage, limit: 20, search: searchTerm });
          setUsers(usersRes.data.users);
          setTotalPages(usersRes.data.totalPages);
          break;
        case 'transactions':
          const txRes = await adminAPI.getTransactions({ page: currentPage, limit: 50 });
          setTransactions(txRes.data.transactions);
          setTotalPages(txRes.data.totalPages);
          break;
        case 'logs':
          const logsRes = await adminAPI.getLogs();
          setLogs(logsRes.data.logs);
          break;
        case 'analytics':
          const analyticsRes = await adminAPI.getAnalytics(30);
          setAnalytics(analyticsRes.data);
          break;
        case 'webhooks':
          const webhooksRes = await adminAPI.getWebhooks();
          setWebhooks(webhooksRes.data.webhooks || []);
          break;
        case 'kyc':
          const kycRes = await adminAPI.getKycPending();
          setPendingKyc(kycRes.data.users || []);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Allow admin access from localhost (dev) or HTTPS (production deployment).
  // Backend middleware enforces actual access control; this is a UI hint only.
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '::1' ||
                      window.location.protocol === 'https:';

  const handleRoleChange = async (userId, newRole) => {
    if (window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      try {
        await adminAPI.updateUserRole(userId, newRole);
        alert('Role updated successfully');
        loadData();
      } catch (error) {
        alert('Error updating role: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone!')) {
      try {
        await adminAPI.deleteUser(userId);
        alert('User deleted successfully');
        loadData();
      } catch (error) {
        alert('Error deleting user: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleViewUser = async (userId) => {
    try {
      const res = await adminAPI.getUserDetails(userId);
      setSelectedUser(res.data);
    } catch (error) {
      alert('Error loading user details: ' + error.message);
    }
  };

  const handleWebhookSubmit = async (e) => {
    e.preventDefault();
    setWebhookMessage('');

    const events = webhookForm.events
      .split(',')
      .map((event) => event.trim())
      .filter(Boolean);

    try {
      if (editingWebhookId) {
        await adminAPI.updateWebhook(editingWebhookId, {
          url: webhookForm.url,
          secret: webhookForm.secret,
          events,
          isActive: webhookForm.isActive
        });
        setWebhookMessage('Webhook updated successfully.');
      } else {
        await adminAPI.createWebhook({
          url: webhookForm.url,
          secret: webhookForm.secret,
          events
        });
        setWebhookMessage('Webhook created successfully.');
      }

      setWebhookForm({
        url: '',
        secret: '',
        events: 'transaction.confirmed,transaction.failed,transaction.reorged',
        isActive: true
      });
      setEditingWebhookId(null);
      loadData();
    } catch (error) {
      setWebhookMessage(error.response?.data?.message || 'Webhook operation failed.');
    }
  };

  const handleWebhookEdit = (webhook) => {
    setEditingWebhookId(webhook._id);
    setWebhookForm({
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events?.join(',') || '',
      isActive: webhook.isActive
    });
    setWebhookMessage('');
  };

  const handleWebhookDelete = async (webhookId) => {
    if (!window.confirm('Delete this webhook?')) return;
    try {
      await adminAPI.deleteWebhook(webhookId);
      setWebhookMessage('Webhook deleted.');
      loadData();
    } catch (error) {
      setWebhookMessage(error.response?.data?.message || 'Failed to delete webhook.');
    }
  };

  const handleApproveKyc = async (userId) => {
    try {
      await adminAPI.approveKyc(userId);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve KYC');
    }
  };

  const handleRejectKyc = async (userId) => {
    try {
      await adminAPI.rejectKyc(userId);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to reject KYC');
    }
  };

  return (
    <div className="admin-dashboard">
      {!isLocalhost && (
        <div style={{
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          border: '2px solid #e74c3c',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="alertTriangle" size={20} color="#ff8800" /> Security Notice
          </h2>
          <p>Admin panel is only accessible from localhost for security reasons.</p>
          <p>Please access via: <strong>http://localhost:3000/admin</strong></p>
          <p>Current URL: {window.location.href}</p>
        </div>
      )}
      <div className="admin-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Icon name="shield" size={32} color="#667eea" /> Admin Dashboard
        </h1>
        <p>Welcome, {user?.name} (Administrator)</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''} 
          onClick={() => { setActiveTab('overview'); setCurrentPage(1); }}
        >
          <Icon name="pieChart" size={18} /> Overview
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => { setActiveTab('users'); setCurrentPage(1); }}
        >
          <Icon name="user" size={18} /> Users
        </button>
        <button 
          className={activeTab === 'transactions' ? 'active' : ''} 
          onClick={() => { setActiveTab('transactions'); setCurrentPage(1); }}
        >
          <Icon name="send" size={18} /> Transactions
        </button>
        <button 
          className={activeTab === 'logs' ? 'active' : ''} 
          onClick={() => { setActiveTab('logs'); setCurrentPage(1); }}
        >
          <Icon name="settings" size={18} /> Logs
        </button>
        <button 
          className={activeTab === 'analytics' ? 'active' : ''} 
          onClick={() => { setActiveTab('analytics'); setCurrentPage(1); }}
        >
          <Icon name="trendingUp" size={18} /> Analytics
        </button>
        <button 
          className={activeTab === 'kyc' ? 'active' : ''} 
          onClick={() => { setActiveTab('kyc'); setCurrentPage(1); }}
        >
          <Icon name="checkCircle" size={18} /> KYC
        </button>
        <button 
          className={activeTab === 'webhooks' ? 'active' : ''} 
          onClick={() => { setActiveTab('webhooks'); setCurrentPage(1); }}
        >
          <Icon name="bell" size={18} /> Webhooks
        </button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <div className="overview-section">
                <h2>Platform Statistics</h2>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>Total Users</h3>
                    <p className="stat-number">{stats.totalUsers}</p>
                    <span className="stat-label">Active (30d): {stats.activeUsers}</span>
                  </div>
                  <div className="stat-card">
                    <h3>Total Wallets</h3>
                    <p className="stat-number">{stats.totalWallets}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Total Transactions</h3>
                    <p className="stat-number">{stats.totalTransactions}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Pending</h3>
                    <p className="stat-number pending">{stats.pendingTransactions}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Completed</h3>
                    <p className="stat-number completed">{stats.completedTransactions}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Failed</h3>
                    <p className="stat-number failed">{stats.failedTransactions}</p>
                  </div>
                </div>

                <div className="recent-section">
                  <div className="recent-users">
                    <h3>Recent Users</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentUsers.map(user => (
                          <tr key={user._id}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="recent-transactions">
                    <h3>Recent Transactions</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Crypto</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentTransactions.map(tx => (
                          <tr key={tx._id}>
                            <td>{tx.type}</td>
                            <td>{tx.cryptocurrency}</td>
                            <td>{tx.amount}</td>
                            <td>
                              <span className={`status ${tx.status}`}>{tx.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="users-section">
                <div className="section-header">
                  <h2>User Management</h2>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadData()}
                  />
                </div>

                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Wallets</th>
                      <th>2FA</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.role}`}>{user.role}</span>
                        </td>
                        <td>{user.walletsCount}</td>
                        <td>{user.twoFactorEnabled ? <Icon name="checkCircle" size={16} color="#30D158" /> : <Icon name="xCircle" size={16} color="#FF453A" />}</td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="actions">
                          <button onClick={() => handleViewUser(user.id)} className="btn-view">View</button>
                          <select 
                            value={user.role} 
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="role-select"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => handleDeleteUser(user.id)} className="btn-delete">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pagination">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="transactions-section">
                <h2>All Transactions</h2>
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Type</th>
                      <th>Crypto</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx._id}>
                        <td>{tx._id.slice(-8)}</td>
                        <td>{tx.userId?.name || 'Unknown'}</td>
                        <td>{tx.type}</td>
                        <td>{tx.cryptocurrency}</td>
                        <td>{tx.amount}</td>
                        <td>
                          <span className={`status ${tx.status}`}>{tx.status}</span>
                        </td>
                        <td>{new Date(tx.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pagination">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="logs-section">
                <h2>System Activity Logs</h2>
                <div className="logs-container">
                  {logs.map((log, index) => (
                    <div key={index} className={`log-entry ${log.status}`}>
                      <span className="log-time">{new Date(log.timestamp).toLocaleString()}</span>
                      <span className="log-action">{log.action}</span>
                      <span className="log-user">{log.user}</span>
                      <span className="log-details">{log.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && analytics && (
              <div className="analytics-section">
                <h2>Analytics (Last 30 Days)</h2>

                <AdminMarketAnalytics />
                
                <div className="analytics-card">
                  <h3>User Growth</h3>
                  <div className="chart-placeholder">
                    {analytics.userGrowth.length > 0 ? (
                      <div className="simple-chart">
                        {analytics.userGrowth.map((data, i) => (
                          <div key={i} className="chart-item">
                            <div className="chart-label">{data._id}</div>
                            <div className="chart-bar" style={{ width: `${data.count * 20}px` }}>
                              {data.count}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No user growth data</p>
                    )}
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>Transaction Volume</h3>
                  <div className="chart-placeholder">
                    {analytics.transactionVolume.length > 0 ? (
                      <div className="simple-chart">
                        {analytics.transactionVolume.map((data, i) => (
                          <div key={i} className="chart-item">
                            <div className="chart-label">{data._id}</div>
                            <div className="chart-bar" style={{ width: `${data.count * 10}px` }}>
                              {data.count} txs
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No transaction data</p>
                    )}
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>Popular Cryptocurrencies</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Cryptocurrency</th>
                        <th>Transactions</th>
                        <th>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.popularCrypto.map((crypto, i) => (
                        <tr key={i}>
                          <td>{crypto._id}</td>
                          <td>{crypto.count}</td>
                          <td>{crypto.totalAmount.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'kyc' && (
              <div className="kyc-section">
                <h2>Pending KYC Reviews</h2>
                {pendingKyc.length === 0 ? (
                  <p>No pending KYC submissions.</p>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Document</th>
                        <th>Number</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingKyc.map((kycUser) => (
                        <tr key={kycUser._id}>
                          <td>{kycUser.kycData?.fullName || kycUser.name}</td>
                          <td>{kycUser.email}</td>
                          <td>{kycUser.kycData?.documentType}</td>
                          <td>{kycUser.kycData?.documentNumber}</td>
                          <td>{kycUser.kycData?.submittedAt ? new Date(kycUser.kycData.submittedAt).toLocaleString() : '-'}</td>
                          <td className="actions">
                            <button className="btn-view" onClick={() => handleApproveKyc(kycUser._id)}>Approve + Provision</button>
                            <button className="btn-delete" onClick={() => handleRejectKyc(kycUser._id)}>Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ marginTop: '2rem' }}>
                  <AdminProvisionWallet />
                </div>
              </div>
            )}

            {activeTab === 'webhooks' && (
              <div className="webhooks-section">
                <h2>Webhook Management</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
                  Events: transaction.confirmed, transaction.failed, transaction.reorged
                </p>

                {webhookMessage && (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(96, 181, 255, 0.15)',
                    borderRadius: '10px',
                    border: '1px solid rgba(96, 181, 255, 0.3)'
                  }}>
                    {webhookMessage}
                  </div>
                )}

                <form onSubmit={handleWebhookSubmit} className="webhook-form" style={{ marginBottom: '2rem' }}>
                  <div className="form-row" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <label className="form-label">Webhook URL</label>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://example.com/webhooks"
                        value={webhookForm.url}
                        onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Secret</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="shared-secret"
                        value={webhookForm.secret}
                        onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr auto', marginTop: '1rem' }}>
                    <div>
                      <label className="form-label">Events (comma-separated)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={webhookForm.events}
                        onChange={(e) => setWebhookForm({ ...webhookForm, events: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={webhookForm.isActive}
                          onChange={(e) => setWebhookForm({ ...webhookForm, isActive: e.target.checked })}
                        />
                        Active
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                    <button type="submit" className="btn btn-primary">
                      {editingWebhookId ? 'Update Webhook' : 'Create Webhook'}
                    </button>
                    {editingWebhookId && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingWebhookId(null);
                          setWebhookForm({
                            url: '',
                            secret: '',
                            events: 'transaction.confirmed,transaction.failed,transaction.reorged',
                            isActive: true
                          });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>URL</th>
                      <th>Events</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((webhook) => (
                      <tr key={webhook._id}>
                        <td>{webhook._id.slice(-8)}</td>
                        <td>{webhook.url}</td>
                        <td>{webhook.events?.join(', ') || '-'}</td>
                        <td>
                          <span className={`status ${webhook.isActive ? 'confirmed' : 'failed'}`}>
                            {webhook.isActive ? 'active' : 'disabled'}
                          </span>
                        </td>
                        <td>{new Date(webhook.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-view" onClick={() => handleWebhookEdit(webhook)}>Edit</button>
                            <button className="btn-delete" onClick={() => handleWebhookDelete(webhook._id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content user-details-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedUser(null)}><Icon name="x" size={20} /></button>
            <h2>User Details</h2>
            
            <div className="user-info">
              <p><strong>Name:</strong> {selectedUser.user.name}</p>
              <p><strong>Email:</strong> {selectedUser.user.email}</p>
              <p><strong>Role:</strong> <span className={`role-badge ${selectedUser.user.role}`}>{selectedUser.user.role}</span></p>
              <p><strong>2FA:</strong> {selectedUser.user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</p>
              <p><strong>Joined:</strong> {new Date(selectedUser.user.createdAt).toLocaleString()}</p>
            </div>

            <h3>Wallets ({selectedUser.user.wallets.length})</h3>
            <div className="wallets-list">
              {selectedUser.user.wallets.map((wallet, i) => (
                <div key={i} className="wallet-item">
                  <p><strong>Address:</strong> {wallet.address}</p>
                  <p><strong>Network:</strong> {wallet.network}</p>
                  <p><strong>Watch-Only:</strong> {wallet.watchOnly ? 'Yes' : 'No'}</p>
                </div>
              ))}
            </div>

            <h3>Recent Transactions ({selectedUser.transactions.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Crypto</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {selectedUser.transactions.map(tx => (
                  <tr key={tx._id}>
                    <td>{tx.type}</td>
                    <td>{tx.cryptocurrency}</td>
                    <td>{tx.amount}</td>
                    <td><span className={`status ${tx.status}`}>{tx.status}</span></td>
                    <td>{new Date(tx.timestamp).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-dashboard {
          padding: 20px;
          max-width: 1600px;
          margin: 0 auto;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }

        .admin-header {
          margin-bottom: 40px;
          text-align: center;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 30px;
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }

        .admin-header h1 {
          font-size: 3rem;
          margin-bottom: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 800;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .admin-header p {
          color: #2c3e50;
          font-size: 1.1rem;
          font-weight: 500;
        }

        .admin-tabs {
          display: flex;
          gap: 15px;
          margin-bottom: 30px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .admin-tabs button {
          padding: 15px 30px;
          border: none;
          background: rgba(255, 255, 255, 0.9);
          color: #2c3e50;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 1rem;
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }

        .admin-tabs button:before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.5s;
        }

        .admin-tabs button:hover:before {
          left: 100%;
        }

        .admin-tabs button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          background: rgba(255, 255, 255, 1);
        }

        .admin-tabs button.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4);
          transform: translateY(-2px);
        }

        .admin-content {
          background: rgba(255, 255, 255, 0.95);
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }

        .loading {
          text-align: center;
          padding: 60px;
          font-size: 1.3rem;
          color: #667eea;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 25px;
          margin-bottom: 40px;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .stat-card:before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
          transition: all 0.5s;
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 40px rgba(102, 126, 234, 0.4);
        }

        .stat-card:hover:before {
          top: -60%;
          right: -60%;
        }

        .stat-card h3 {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 15px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .stat-number {
          font-size: 2.8rem;
          font-weight: 800;
          color: white;
          margin: 15px 0;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        .stat-number.pending { color: #ffd93d; }
        .stat-number.completed { color: #6bcf7f; }
        .stat-number.failed { color: #ff6b9d; }

        .stat-label {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        .recent-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-top: 40px;
        }

        .recent-section > div {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
          padding: 25px;
          border-radius: 16px;
          border: 1px solid rgba(102, 126, 234, 0.2);
        }

        .recent-section h3 {
          color: #667eea;
          font-size: 1.3rem;
          margin-bottom: 20px;
          font-weight: 700;
        }

        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-top: 20px;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }

        table th {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px;
          text-align: left;
          font-weight: 700;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        table td {
          padding: 16px;
          border-bottom: 1px solid rgba(102, 126, 234, 0.1);
          color: #2c3e50;
          font-size: 0.95rem;
        }

        table tbody tr {
          transition: all 0.2s ease;
        }

        table tbody tr:hover {
          background: linear-gradient(90deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
          transform: scale(1.01);
        }

        table tbody tr:last-child td {
          border-bottom: none;
        }

        .status {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: inline-block;
        }

        .status.pending { 
          background: linear-gradient(135deg, #f39c12 0%, #f1c40f 100%);
          color: white; 
          box-shadow: 0 2px 10px rgba(243, 156, 18, 0.3);
        }
        .status.completed { 
          background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
          color: white;
          box-shadow: 0 2px 10px rgba(39, 174, 96, 0.3);
        }
        .status.failed { 
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          box-shadow: 0 2px 10px rgba(231, 76, 60, 0.3);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .section-header h2 {
          color: #667eea;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .section-header input {
          padding: 12px 20px;
          border: 2px solid #667eea;
          border-radius: 12px;
          background: white;
          color: #2c3e50;
          width: 320px;
          font-size: 0.95rem;
          transition: all 0.3s ease;
        }

        .section-header input:focus {
          outline: none;
          border-color: #764ba2;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .role-badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .role-badge.user { 
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          color: white;
          box-shadow: 0 2px 10px rgba(52, 152, 219, 0.3);
        }
        .role-badge.admin { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
        }

        .actions {
          display: flex;
          gap: 10px;
        }

        .actions button, .role-select {
          padding: 8px 16px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-size: 040px;
        }

        .pagination button {
          padding: 12px 24px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .pagination button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
          box-shadow: none;
        }

        .pagination span {
          color: #2c3e50;
          font-weight: 600;
          font-size: 1rem;
        }

        .logs-container {
          max-height: 700px;
          overflow-y: auto;
          padding-right: 10px;
        }

        .logs-container::-webkit-scrollbar {
          width: 8px;
        }

        .logs-container::-webkit-scrollbar-track {
          background: rgba(102, 126, 234, 0.1);
          border-radius: 10px;
        }

        .logs-container::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
        }

        .log-entry {
          display: grid;
          grid-template-columns: 180px 150px 250px 1fr;
          gap: 15px;
          padding: 18px;
          border-left: 5px solid #667eea;
          margin-bottom: 15px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
        }

        .log-entry:hover {
          transform: translateX(5px);
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.15);
        }

        .log-entry.completed { 
          border-left-color: #27ae60;
          background: linear-gradient(90deg, rgba(39, 174, 96, 0.05) 0%, white 100%);
        }
        .log-entry.pending { 
          border-left-color: #f39c12;
          background: linear-gradient(90deg, rgba(243, 156, 18, 0.05) 0%, white 100%);
        }
        .log-entry.f
          color: #7f8c8d;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .log-action { 
          font-weight: 700;
          color: #2c3e50;
        }
        .log-user { 
          color: #667eea;
          font-weight: 600;
        }
        .log-details { 
          font-size: 0.9rem;
          color: #34495e;
        }

        .analytics-card {
          margin-bottom: 35px;
          padding: 30px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(102, 126, 234, 0.2);
        }

        .analytics-card h3 {
          color: #667eea;
          font-size: 1.5rem;
          margin-bottom: 25px;
          font-weight: 700;
        }

        .simple-chart {
          margin-top: 25px;
        }

        .chart-item {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
        }

        .chart-label {
          width: 120px;
          font-size: 0.95rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .chart-bar {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 700;
          box-shadow: 0 3px 15px rgba(102, 126, 234, 0.3);
          transition: all 0.3s ease;
        }

        .chart-bar:hover {
          transform: translateX(5px);
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: white;
          padding: 40px;
          border-radius: 20px;
          max-width: 900px;
          max-height: 85vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-content h2 {
          color: #667eea;
          font-size: 2rem;
          margin-bottom: 25px;
          font-weight: 700;
        }

        .modal-content h3 {
          color: #764ba2;
          font-size: 1.4rem;
          margin-top: 30px;
          margin-bottom: 20px;
          font-weight: 700;
        }

        .modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 1.5rem;
          cursor: pointer;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .modal-close:hover {
          transform: rotate(90deg) scale(1.1);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .user-info {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 25px;
        }

        .user-info p {
          margin: 12px 0;
          font-size: 1.05rem;
          color: #2c3e50;
        }

        .user-info strong {
          color: #667eea;
          font-weight: 700;
        }

        .wallets-list {
          max-height: 250px;
          overflow-y: auto;
          margin-bottom: 25px;
        }

        .wallet-item {
          padding: 15px;
          background: linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(41, 128, 185, 0.1) 100%);
          margin-bottom: 12px;
          border-radius: 10px;
          border-left: 4px solid #3498db;
        }

        .wallet-item p {
          margin: 8px 0;
          font-size: 0.95rem;
          color: #2c3e50;
        }

        .wallet-item strong {
          color: #3498db;
          font-weight: 7000, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--card-bg);
          padding: 30px;
          border-radius: 12px;
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-close {
          position: absolute;
          top: 15px;
          right: 15px;
          background: transparent;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--text-color);
        }

        .user-info p {
          margin: 10px 0;
          font-size: 1rem;
        }

        .wallets-list {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 20px;
        }

        .wallet-item {
          padding: 10px;
          background: var(--hover-bg);
          margin-bottom: 10px;
          border-radius: 6px;
        }

        .wallet-item p {
          margin: 5px 0;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .recent-section {
            grid-template-columns: 1fr;
          }

          .section-header {
            flex-direction: column;
            gap: 15px;
          }

          .section-header input {
            width: 100%;
          }

          .log-entry {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .admin-tabs {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default AdminDashboard;
