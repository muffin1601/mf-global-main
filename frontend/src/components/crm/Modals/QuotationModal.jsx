import React, { useState, useEffect, useRef } from 'react';
import { FiTrash2, FiArrowRight, FiArrowLeft, FiX, FiDownload } from 'react-icons/fi';
import CustomToast from '../CustomToast';
import { toast } from 'react-toastify';
import { generateQuotationPDF } from '../../../utils/pdfGenerator';

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '—';
    const numericAmount = parseFloat(amount);
    if (numericAmount === 0) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(0);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(numericAmount);
};

const QuotationModal = ({ isOpen, onClose, selectedProducts }) => {
    const [allCustomers, setAllCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [quotationList, setQuotationList] = useState([]);
    const [grandTotal, setGrandTotal] = useState(0);
    const [step, setStep] = useState(1);
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [notes, setNotes] = useState('');

    const searchInputRef = useRef(null);

    const calculateTotalPrice = (product, quantity) => {
        const price = product.p_price?.single_price || 0;
        const gst = product.GST_rate || 0;
        const numericQuantity = parseInt(quantity) || 0;
        if (numericQuantity <= 0) return (0).toFixed(2);
        const total = parseFloat(price) * numericQuantity * (1 + parseFloat(gst) / 100);
        return total.toFixed(2);
    };

    useEffect(() => {
        if (isOpen) {
            setCustomerName('');
            setCustomerAddress('');
            setNotes('');
            setSearchTerm('');

            fetch(`${import.meta.env.VITE_API_URL}/overview/all-clients`)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch clients');
                    return res.json();
                })
                .then(data => setAllCustomers(data))
                .catch(err => {
                    console.error('Customer fetch error:', err);
                    toast(<CustomToast type="error" title="Error" message="Could not load customer data." />);
                });
        }
    }, [isOpen]);

    useEffect(() => {
        const filtered = allCustomers.filter(
            (c) =>
                c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone?.includes(searchTerm)
        ).slice(0, 5);
        setFilteredCustomers(filtered);
    }, [searchTerm, allCustomers]);

    useEffect(() => {
        if (isOpen && selectedProducts && selectedProducts.length > 0) {
            const list = selectedProducts.map((p) => ({
                ...p,
                quantity: 1,
                totalPrice: calculateTotalPrice(p, 1),
            }));
            setQuotationList(list);
            setStep(1);
        } else if (isOpen && selectedProducts && selectedProducts.length === 0) {
            setQuotationList([]);
            setStep(1);
        }
    }, [selectedProducts, isOpen]);

    useEffect(() => {
        const total = quotationList.reduce(
            (acc, item) => acc + parseFloat(item.totalPrice || 0),
            0
        );
        setGrandTotal(total.toFixed(2));
    }, [quotationList]);

    useEffect(() => {
        if (step === 2 && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [step]);

    const handleQuantityChange = (index, qty) => {
        const quantity = parseInt(qty) || 0;
        if (quantity < 0) return;

        const updated = [...quotationList];
        const safeQuantity = Math.max(0, quantity);

        updated[index].quantity = safeQuantity;
        updated[index].totalPrice = calculateTotalPrice(updated[index], safeQuantity);
        setQuotationList(updated);
    };

    const handleRemoveProduct = (id) => {
        const updated = quotationList.filter(p => p._id !== id);
        setQuotationList(updated);
        toast(<CustomToast type="info" title="Removed" message="Product removed from the list." />);
    };

    const generatePDF = () => {
        if (quotationList.length === 0) {
            toast(<CustomToast type="warning" title="Empty List" message="The quotation list is empty. Cannot generate PDF." />);
            setStep(1);
            return;
        }
        if (!customerName.trim() || !customerAddress.trim()) {
            toast(<CustomToast type="error" title="Missing Info" message="Please enter Customer Name and Address to proceed." />);
            return;
        }

        generateQuotationPDF(
            quotationList,
            grandTotal,
            customerName,
            customerAddress,
            notes
        );

        toast(<CustomToast type="success" title="Success" message="Quotation PDF generated and downloaded successfully!" />);
        onClose();
    };

    const handleSelectCustomer = (customer) => {
        setCustomerName(customer.company || customer.name || '');
        setCustomerAddress(customer.address || '');
        setNotes(customer.remarks || '');
        setSearchTerm('');
        setFilteredCustomers([]);
    };

    if (!isOpen) return null;

    const isListEmpty = quotationList.length === 0;

    return (
        <div className="quotation-modal-overlay">
            <div className="quotation-modal-content">
                <div className="step-indicator">
                    <span className={`step ${step === 1 ? 'active' : ''}`}>1. Review Products & Quantity</span>
                    <span className="separator">→</span>
                    <span className={`step ${step === 2 ? 'active' : ''}`}>2. Customer Details & PDF</span>
                </div>
                <h3 className="modal-title">{step === 1 ? 'Step 1: Adjust Product Quantities' : 'Step 2: Enter Customer Details'}</h3>
                <hr />

                {step === 1 && (
                    <>
                        {isListEmpty ? (
                            <div className="empty-message">
                                <p>⚠️ No products selected for quotation. Please close the modal, search, and select products first.</p>
                                <button className="close-btn" onClick={onClose}>
                                    <FiX size={18} style={{ marginRight: '6px' }} /> Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <table className="quotation-table">
                                    <thead>
                                        <tr>
                                            <th>Code</th>
                                            <th>Name</th>
                                            <th>Unit Price (Excl. Tax)</th>
                                            <th>GST (%)</th>
                                            <th className="qty-col">Quantity</th>
                                            <th>Total Price (Incl. Tax)</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quotationList.map((p, i) => (
                                            <tr key={p._id || `temp-${i}`}>
                                                <td>{p.product_code || 'N/A'}</td>
                                                <td className="product-name">{p.p_name}</td>
                                                <td>{formatCurrency(p.p_price?.single_price)}</td>
                                                <td>{p.GST_rate ? `${p.GST_rate}%` : '0%'}</td>
                                                <td className="qty-col">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={p.quantity}
                                                        onChange={(e) => handleQuantityChange(i, e.target.value)}
                                                        className="quantity-input"
                                                        required
                                                    />
                                                </td>
                                                <td className="total-price-col">
                                                    <strong>{formatCurrency(p.totalPrice)}</strong>
                                                </td>
                                                <td>
                                                    <button className="remove-btn" onClick={() => handleRemoveProduct(p._id)}>
                                                        <FiTrash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="grand-total">
                                    <strong>Grand Total (Incl. All Taxes): </strong>
                                    <span>{formatCurrency(grandTotal)}</span>
                                </div>
                                <div className="modal-buttons">
                                    <button className="back-btn" onClick={onClose}>
                                        <FiX size={18} style={{ marginRight: '6px' }} /> Close
                                    </button>
                                    <button className="generate-btn next-step-btn" onClick={() => setStep(2)} disabled={isListEmpty}>
                                        Proceed to Details <FiArrowRight size={18} style={{ marginLeft: '6px' }} />
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="form-group" style={{ position: 'relative' }}>
                            <label htmlFor="customer-search">Search & Select Customer (Company / Phone)</label>
                            <input
                                id="customer-search"
                                type="text"
                                ref={searchInputRef}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Start typing company name or phone number..."
                                autoComplete="off"
                            />
                            {filteredCustomers.length > 0 && searchTerm.trim() && (
                                <ul className="search-dropdown-list">
                                    {filteredCustomers.map((customer) => (
                                        <li key={customer._id} onClick={() => handleSelectCustomer(customer)} title={`Select ${customer.company}`}>
                                            <span>{customer.company}</span>
                                            <span> - {customer.phone}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="customer-name">Customer Name *</label>
                            <input
                                id="customer-name"
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Enter customer name (required)"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="customer-address">Customer Address *</label>
                            <textarea
                                id="customer-address"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                                placeholder="Enter customer address for the quotation document (required)"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="notes">Notes / Terms (Optional)</label>
                            <textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="E.g., Payment terms, Validity period, Delivery schedule..."
                            />
                        </div>

                        <div className="modal-buttons">
                            <button className="back-btn" onClick={() => setStep(1)}>
                                <FiArrowLeft size={18} style={{ marginRight: '6px' }} /> Back to List
                            </button>
                            <button className="generate-btn" onClick={generatePDF} disabled={!customerName.trim() || !customerAddress.trim()}>
                                <FiDownload size={18} style={{ marginRight: '6px' }} /> Generate & Download PDF
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default QuotationModal;


const css = `
.quotation-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(18, 24, 39, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
}
.quotation-modal-content {
    width: 95%;
    max-width: 900px;
    max-height: 72vh;
    overflow-y: auto;
    background: #ffffff;
    border-radius: 16px;
    padding: 3rem 2.5rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    font-family: 'Inter', 'Outfit', Arial, sans-serif;
    border: none;
    animation: modalScaleIn 0.35s cubic-bezier(0.25, 0.8, 0.25, 1.25);
}
@keyframes modalScaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
.step-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    margin-bottom: 40px;
}
.step {
    padding: 10px 22px;
    border-radius: 10px;
    font-weight: 600;
    color: #475569;
    background: #f8fafc;
    font-size: 1rem;
    letter-spacing: 0.01em;
    transition: background 0.3s, color 0.3s, transform 0.2s;
    border: 1px solid #e2e8f0;
}
.step.active {
    background: #1e3a8a;
    color: #fff;
    font-weight: 700;
    box-shadow: 0 6px 15px rgba(30, 58, 138, 0.4);
    transform: scale(1.02);
    border-color: #1e3a8a;
}
.separator {
    color: #cbd5e1;
    font-size: 1.6rem;
}
.modal-title {
    font-size: 2rem;
    color: #0f172a;
    margin-bottom: 2rem;
    text-align: center;
    font-weight: 900;
    letter-spacing: -0.02em;
}
hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin-bottom: 2rem !important;
}

/* --- Table Styles --- */
.quotation-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 1.5rem;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}
.quotation-table thead {
    background: #1e3a8a;
}
.quotation-table th {
    color: #fff;
    font-weight: 700;
    font-size: 1rem;
    padding: 1rem 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.quotation-table td {
    background: #fff;
    border-bottom: 1px solid #f1f5f9;
    padding: 1rem 0.8rem;
    text-align: left;
    font-size: 0.95rem;
    color: #334155;
    vertical-align: middle;
}
.quotation-table tr:hover td {
    background-color: #f8fafc;
}
.quotation-table tr:last-child td {
    border-bottom: none;
}
.qty-col, .total-price-col {
    text-align: center;
}
.product-name {
    font-weight: 600;
    color: #1e293b;
}
.quantity-input {
    width: 70px;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    background: #fff;
    transition: all 0.2s;
}
.quantity-input:focus {
    border-color: #1e3a8a;
    outline: none;
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
}
.grand-total {
    margin-top: 2rem;
    font-size: 1.4rem;
    text-align: right;
    font-weight: 800;
    color: #0f172a;
    padding: 1.5rem 0;
    border-top: 2px solid #e2e8f0;
    letter-spacing: 0.01em;
}
.grand-total span {
    color: #b91c1c;
    margin-left: 10px;
}
.remove-btn {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.6rem 0.8rem;
    font-size: 0.9rem;
    font-weight: 600;
    border: 1px solid #fca5a5;
    border-radius: 8px;
}
.remove-btn:hover {
    background: #fee2e2;
    transform: translateY(-2px);
    box-shadow: 0 2px 5px rgba(220, 38, 38, 0.2);
}

/* --- Form Styles --- */
.form-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 1.75rem;
    gap: 0.75rem;
}
.form-group label {
    font-weight: 700;
    color: #1e293b;
    font-size: 1.05rem;
    margin-bottom: 0.2rem;
}
.form-group input,
.form-group textarea {
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    font-family: inherit;
    font-size: 1rem;
    background: #f8fafc;
    color: #1e293b;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    background: #fff;
    border-color: #1e3a8a;
    box-shadow: 0 0 0 4px rgba(30, 58, 138, 0.1);
}
.form-group textarea {
    min-height: 120px;
}

/* --- Button Styles --- */
.modal-buttons {
    display: flex;
    gap: 1.25rem;
    justify-content: flex-end;
    margin-top: 3rem;
}
.generate-btn, .close-btn, .back-btn {
    border: none;
    font-size: 1.05rem;
    font-family: inherit;
    padding: 1rem 2rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    font-weight: 700;
    letter-spacing: 0.03em;
}

/* Primary Button (Generate PDF) */
.generate-btn {
    background: #059669;
    color: #fff;
    box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4);
}
.generate-btn:hover {
    background: #047857;
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(5, 150, 105, 0.5);
}
.generate-btn:disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
}

/* Secondary Button (Close/Back) */
.back-btn {
    background: #475569;
    color: #fff;
    box-shadow: 0 2px 10px rgba(71, 85, 105, 0.2);
}
.back-btn:hover {
    background: #334155;
    transform: translateY(-2px);
}
.close-btn {
    background: #f1f5f9;
    color: #475569;
    padding: 0.8rem 1.5rem;
}
.close-btn:hover {
    background: #e2e8f0;
}

/* Empty State */
.empty-message {
    text-align: center;
    padding: 40px 20px;
    background: #fefce8;
    border: 1px solid #fde047;
    border-radius: 12px;
    margin-top: 20px;
    color: #854d0e;
    font-size: 1.15rem;
    font-weight: 600;
}

/* Search Dropdown */
.search-dropdown-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    border: 1px solid #e2e8f0;
    max-height: 220px;
    overflow-y: auto;
    background: white;
    z-index: 10;
    padding: 5px 0;
    margin: 8px 0 0 0;
    list-style: none;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
}
.search-dropdown-list li {
    padding: 12px 18px;
    cursor: pointer;
    font-size: 1rem;
    border-bottom: 1px solid #f1f5f9;
    transition: background-color 0.2s;
}
.search-dropdown-list li:hover {
    background-color: #eef2ff;
}
.search-dropdown-list li:last-child {
    border-bottom: none;
}
.search-dropdown-list li span {
    display: inline-block;
}
.search-dropdown-list li span:first-child {
    font-weight: 700;
    color: #1e3a8a;
}
.search-dropdown-list li span:last-child {
    color: #64748b;
    margin-left: 10px;
}


/* --- Mobile Responsiveness --- */
@media (max-width: 768px) {
    .quotation-modal-content {
        padding: 2rem 1rem;
    }
    .modal-title {
        font-size: 1.75rem;
    }
    .modal-buttons {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
    }
    .generate-btn, .close-btn, .back-btn {
        width: 100%;
        padding: 0.9rem 1.5rem;
    }
    .quotation-table th,
    .quotation-table td {
        padding: 0.7rem 0.5rem;
        font-size: 0.9rem;
    }
    .quotation-table th:nth-child(3),
    .quotation-table td:nth-child(3),
    .quotation-table th:nth-child(4),
    .quotation-table td:nth-child(4) {
        display: none;
    }
    .step-indicator {
        flex-direction: column;
        gap: 10px;
    }
    .separator {
        display: none;
    }
    .step {
        width: 100%;
        text-align: center;
    }
    .grand-total {
        font-size: 1.2rem;
    }
}
`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);