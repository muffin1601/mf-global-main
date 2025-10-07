import React, { useState, useEffect } from 'react';
import CustomToast from '../CustomToast';
import { toast } from 'react-toastify';
import { generateQuotationPDF } from '../../../utils/pdfGenerator';

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '—';
    const numericAmount = parseFloat(amount);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(numericAmount);
};

const QuotationModal = ({ isOpen, onClose, selectedProducts }) => {
    const [quotationList, setQuotationList] = useState([]);
    const [grandTotal, setGrandTotal] = useState(0);
    const [step, setStep] = useState(1);
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [notes, setNotes] = useState('');

    const calculateTotalPrice = (product, quantity) => {
        const price = product.p_price?.single_price || 0;
        const gst = product.GST_rate || 0;
        const total = parseFloat(price) * (parseInt(quantity) || 0) * (1 + parseFloat(gst) / 100);
        return total.toFixed(2);
    };

    useEffect(() => {
        if (isOpen && selectedProducts && selectedProducts.length > 0) {
            const list = selectedProducts.map((p) => ({
                ...p,
                quantity: 1,
                totalPrice: calculateTotalPrice(p, 1),
            }));
            setQuotationList(list);
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

    const handleQuantityChange = (index, qty) => {
        const quantity = parseInt(qty) || 0;
        if (quantity < 0) return;
        const updated = [...quotationList];
        updated[index].quantity = quantity;
        updated[index].totalPrice = calculateTotalPrice(updated[index], quantity);
        setQuotationList(updated);
    };

    const handleRemoveProduct = (id) => {
        const updated = quotationList.filter(p => p._id !== id);
        setQuotationList(updated);
        toast(<CustomToast type="info" title="Removed" message="Product removed from the list." />);
    };

    const generatePDF = () => {
        if (!customerName.trim() || !customerAddress.trim()) {
            toast(<CustomToast type="error" title="Missing Info" message="Please enter Customer Name and Address." />);
            return;
        }
        generateQuotationPDF(
            quotationList,
            grandTotal,
            customerName,
            customerAddress,
            notes
        );

        toast(<CustomToast type="success" title="Success" message="Quotation PDF generated and downloaded!" />);
        onClose();
    };

    if (!isOpen) return null;

    const isListEmpty = quotationList.length === 0;

    return (
        <div className="quotation-modal-overlay">
            <div className="quotation-modal-content">
                <div className="step-indicator">
                    <span className={`step ${step === 1 ? 'active' : ''}`}>1. Review Products & Quantity</span>
                    <span className="separator">→</span>
                    <span className={`step ${step === 2 ? 'active' : ''}`}>2. Customer Details & Generate PDF</span>
                </div>
                <h3 className="modal-title">{step === 1 ? 'Step 1: Adjust Quantities' : 'Step 2: Enter Customer Details'}</h3>
                {step === 1 && (
                    <>
                        {isListEmpty ? (
                            <div className="empty-message">
                                <p>⚠️ No products selected for quotation. Please search and select products first.</p>
                                <button className="close-btn" onClick={onClose}>Close</button>
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
                                            <tr key={p._id}>
                                                <td>{p.product_code}</td>
                                                <td className="product-name">{p.p_name}</td>
                                                <td>{formatCurrency(p.p_price?.single_price)}</td>
                                                <td>{p.GST_rate || 0}%</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={p.quantity}
                                                        onChange={(e) => handleQuantityChange(i, e.target.value)}
                                                        className="quantity-input"
                                                        required
                                                    />
                                                </td>
                                                <td className="total-price-col">{formatCurrency(p.totalPrice)}</td>
                                                <td>
                                                    <button
                                                        className="remove-btn"
                                                        onClick={() => handleRemoveProduct(p._id)}>
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="grand-total">
                                    <strong>Grand Total (Incl. All Taxes): </strong> {formatCurrency(grandTotal)}
                                </div>
                                <div className="modal-buttons">
                                    <button className="back-btn" onClick={onClose}>
                                        Cancel
                                    </button>
                                    <button className="generate-btn" onClick={() => setStep(2)} disabled={isListEmpty}>
                                        Proceed to Details →
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}
                {step === 2 && (
                    <>
                        <div className="form-group">
                            <label htmlFor="customer-name">Customer Name *</label>
                            <input
                                id="customer-name"
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Enter customer name"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="customer-address">Customer Address *</label>
                            <textarea
                                id="customer-address"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                                placeholder="Enter customer address for the quotation document"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="notes">Notes (Optional)</label>
                            <textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="E.g., Payment terms, Validity period..."
                            />
                        </div>
                        <div className="modal-buttons">
                            <button className="back-btn" onClick={() => setStep(1)}>
                                ← Back to List
                            </button>
                            <button className="generate-btn" onClick={generatePDF} disabled={!customerName.trim() || !customerAddress.trim()}>
                                Generate & Download PDF
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
    background: rgba(30, 41, 59, 0.75);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
}
.quotation-modal-content {
    width: 95%;
    max-width: 900px;
    max-height: 92vh;
    overflow-y: auto;
    background: #fff;
    border-radius: 20px;
    padding: 2.5rem 2rem 2rem 2rem;
    box-shadow: 0 8px 32px rgba(30,41,59,0.18);
    font-family: 'Inter', 'Outfit', Arial, sans-serif;
    border: 1.5px solid #e5e7eb;
    animation: modalFadeIn 0.3s;
}
@keyframes modalFadeIn {
    from { opacity: 0; transform: translateY(30px);}
    to { opacity: 1; transform: translateY(0);}
}
.step-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
}
.step {
    padding: 7px 18px;
    border-radius: 10px;
    font-weight: 500;
    color: #64748b;
    background: #f1f5f9;
    font-size: 1rem;
    letter-spacing: 0.01em;
    transition: background 0.2s, color 0.2s;
}
.step.active {
    background: linear-gradient(90deg, #2563eb 60%, #38bdf8 100%);
    color: #fff;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(56,189,248,0.12);
}
.separator {
    color: #cbd5e1;
    font-size: 1.3rem;
}
.modal-title {
    font-size: 2rem;
    color: #1e293b;
    margin-bottom: 2rem;
    text-align: center;
    font-weight: 800;
    letter-spacing: 0.01em;
}
.quotation-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 1.2rem;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 6px rgba(30,41,59,0.07);
    background: #f8fafc;
}
.quotation-table th {
    background: linear-gradient(90deg, #38bdf8 100%);
    color: #fff;
    font-weight: 700;
    border: none;
    font-size: 1rem;
    padding: 0.9rem 0.5rem;
}
.quotation-table th,
.quotation-table td {
    padding: 0.9rem 0.5rem;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
    font-size: 0.98rem;
}
.quotation-table tr:last-child td {
    border-bottom: none;
}
.quotation-table td {
    vertical-align: middle;
    background: #fff;
}
.qty-col, .total-price-col {
    text-align: center;
}
.product-name {
    text-align: left !important;
    font-weight: 500;
    color: #2563eb;
}
.quantity-input {
    width: 60px;
    padding: 0.4rem;
    border-radius: 7px;
    border: 1.5px solid #cbd5e1;
    text-align: center;
    font-size: 1rem;
    background: #f1f5f9;
    transition: border-color 0.2s;
}
.quantity-input:focus {
    border-color: #2563eb;
    outline: none;
    background: #fff;
}
.grand-total {
    margin-top: 1.7rem;
    font-size: 1.18rem;
    text-align: right;
    font-weight: 800;
    color: #2563eb;
    padding: 0.7rem 0;
    border-top: 2px solid #e0e7ef;
    letter-spacing: 0.01em;
}
.form-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 1.3rem;
    gap: 0.5rem;
}
.form-group label {
    font-weight: 700;
    color: #334155;
    font-size: 1.05rem;
    margin-bottom: 0.2rem;
}
.form-group input,
.form-group textarea {
    padding: 0.8rem 1.1rem;
    border-radius: 10px;
    border: 1.5px solid #cbd5e1;
    font-family: inherit;
    font-size: 1.02rem;
    background: #f8fafc;
    transition: border-color 0.2s, background 0.2s;
}
.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    border-color: #2563eb;
    background: #fff;
    box-shadow: 0 0 0 2px #38bdf855;
}
.form-group textarea {
    resize: vertical;
    min-height: 90px;
}
.empty-message {
    text-align: center;
    padding: 32px 18px;
    background: #fef9c3;
    border: 1.5px solid #fde68a;
    border-radius: 12px;
    margin-top: 22px;
    color: #b45309;
    font-size: 1.1rem;
    font-weight: 500;
}
.modal-buttons {
    display: flex;
    gap: 1.1rem;
    justify-content: flex-end;
    margin-top: 2rem;
}
.generate-btn, .close-btn, .remove-btn, .back-btn {
    border: none;
    font-size: 1rem;
    font-family: inherit;
    padding: 0.7rem 1.5rem;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.18s, color 0.18s, transform 0.1s;
    font-weight: 600;
    letter-spacing: 0.01em;
}
.generate-btn {
    background: linear-gradient(90deg, #22c55e 60%, #16a34a 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(34,197,94,0.10);
}
.generate-btn:hover {
    background: linear-gradient(90deg, #16a34a 60%, #22c55e 100%);
}
.generate-btn:disabled {
    background: #cbd5e1;
    color: #64748b;
    cursor: not-allowed;
}
.close-btn {
    background: #64748b;
    color: #fff;
    margin-top: 18px;
    padding: 0.5rem 1.1rem;
}
.close-btn:hover {
    background: #334155;
}
.back-btn {
    background: linear-gradient(90deg, #fbbf24 60%, #f59e42 100%);
    color: #1e293b;
}
.back-btn:hover {
    background: linear-gradient(90deg, #f59e42 60%, #fbbf24 100%);
}
.remove-btn {
    background: linear-gradient(90deg, #ef4444 60%, #f87171 100%);
    color: #fff;
    padding: 0.4rem 1rem;
    font-size: 0.93rem;
}
.remove-btn:hover {
    background: linear-gradient(90deg, #b91c1c 60%, #ef4444 100%);
}
@media (max-width: 700px) {
    .quotation-modal-content {
        padding: 1.2rem 0.5rem 1.2rem 0.5rem;
        width: 99vw;
        max-width: 99vw;
    }
    .modal-buttons {
        flex-direction: column;
        align-items: stretch;
        gap: 0.7rem;
    }
    .generate-btn,
    .close-btn,
    .back-btn {
        width: 100%;
    }
    .quotation-table th,
    .quotation-table td {
        padding: 0.5rem;
        font-size: 0.9rem;
    }
    .step-indicator {
        flex-direction: column;
        gap: 7px;
    }
    .separator {
        display: none;
    }
    .modal-title {
        font-size: 1.3rem;
    }
}
`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);