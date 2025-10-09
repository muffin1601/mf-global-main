import React, { useState, useEffect, useRef } from 'react';
import { FiTrash2, FiArrowRight, FiArrowLeft, FiX, FiDownload } from 'react-icons/fi';
import CustomToast from '../CustomToast';
import { toast } from 'react-toastify';
import { generateQuotationPDF } from '../../../utils/pdfGenerator';

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '—';
    const numericAmount = parseFloat(amount);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(numericAmount || 0);
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
    const [quotationNumber, setQuotationNumber] = useState('');
    const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);

    const searchInputRef = useRef(null);

    const calculateTotalPrice = (product, quantity) => {
        const price = parseFloat(product.p_price?.single_price || 0);
        const gst = parseFloat(product.GST_rate || 0);
        const qty = parseInt(quantity) || 0;
        if (qty <= 0) return '0.00';
        return (price * qty * (1 + gst / 100)).toFixed(2);
    };

    useEffect(() => {
        if (isOpen) {
            setCustomerName('');
            setCustomerAddress('');
            setNotes('');
            setSearchTerm('');

            fetch(`${import.meta.env.VITE_API_URL}/overview/all-clients`)
                .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch clients'))
                .then(data => setAllCustomers(data.data || []))
                .catch(err => toast(<CustomToast type="error" title="Error" message="Could not load customer data." />));
        }
    }, [isOpen]);

    useEffect(() => {
        const filtered = allCustomers.filter(
            c => c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone?.includes(searchTerm)
        ).slice(0, 5);
        setFilteredCustomers(filtered);
    }, [searchTerm, allCustomers]);

    useEffect(() => {
        if (isOpen && selectedProducts?.length > 0) {
            const list = selectedProducts.map(p => ({
                ...p,
                quantity: 1,
                totalPrice: calculateTotalPrice(p, 1)
            }));
            setQuotationList(list);
            setStep(1);
        } else setQuotationList([]);
    }, [selectedProducts, isOpen]);

    useEffect(() => {
        const total = quotationList.reduce((acc, item) => acc + parseFloat(item.totalPrice || 0), 0);
        setGrandTotal(total.toFixed(2));
    }, [quotationList]);

    useEffect(() => {
        if (step === 2 && searchInputRef.current) searchInputRef.current.focus();
    }, [step]);

    const handleQuantityChange = (index, qty) => {
        const quantity = Math.max(0, parseInt(qty) || 0);
        const updated = [...quotationList];
        updated[index].quantity = quantity;
        updated[index].totalPrice = calculateTotalPrice(updated[index], quantity);
        setQuotationList(updated);
    };

    const handleProductDetailChange = (index, field, value) => {
        const updated = [...quotationList];
        if (field === 'p_name') updated[index].p_name = value;
        else if (field === 'p_price') updated[index].p_price.single_price = parseFloat(value) || 0;
        else if (field === 'GST_rate') updated[index].GST_rate = parseFloat(value) || 0;
        updated[index].totalPrice = calculateTotalPrice(updated[index], updated[index].quantity);
        setQuotationList(updated);
    };

    const handleRemoveProduct = (id) => {
        setQuotationList(quotationList.filter(p => p._id !== id));
        toast(<CustomToast type="info" title="Removed" message="Product removed from the list." />);
    };

    const handleSelectCustomer = (customer) => {
        setCustomerName(customer.company || customer.name || '');
        setCustomerAddress(customer.address || '');
        setNotes(customer.remarks || '');
        setSearchTerm('');
        setFilteredCustomers([]);
    };

    const generatePDFAndSave = async () => {
    if (quotationList.length === 0) {
        toast(<CustomToast type="warning" title="Empty List" message="No products selected." />);
        setStep(1);
        return;
    }
    if (!customerName.trim() || !customerAddress.trim()) {
        toast(<CustomToast type="error" title="Missing Info" message="Please enter customer details." />);
        return;
    }

    const quotationData = {
        quotationNumber,
        quotationDate,
        customerName,
        customerAddress,
        notes,
        products: quotationList,
        grandTotal: parseFloat(grandTotal), // ensure number
    };

    console.log('Sending quotationData:', quotationData);

    try {
       
        await generateQuotationPDF(quotationData);

        const res = await fetch(`${import.meta.env.VITE_API_URL}/quotations/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(quotationData),
        });

        const data = await res.json().catch(() => null); // parse response safely

        if (!res.ok) {
            console.error('Server responded with error:', data);
            toast(<CustomToast type="error" title="Server Error" message={data?.message || 'Failed to save quotation'} />);
            return;
        }

        toast(<CustomToast type="success" title="Success" message="Quotation PDF generated & saved!" />);
        onClose();
    } catch (err) {
        console.error('Network / JS error:', err);
        toast(<CustomToast type="error" title="Error" message="Failed to generate or save quotation." />);
    }
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

                <h3 className="modal-title">{step === 1 ? 'Step 1: Adjust Product Details & Quantities' : 'Step 2: Enter Customer Details'}</h3>
                <hr />

                {step === 1 && (
                    <>
                        {isListEmpty ? (
                            <div className="empty-message">
                                <p>⚠️ No products selected. Close the modal and select products first.</p>
                                <button className="close-btn" onClick={onClose}><FiX size={18} style={{ marginRight: '6px' }} /> Close</button>
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
                                                <td><input type="text" value={p.p_name} onChange={e => handleProductDetailChange(i, 'p_name', e.target.value)} className="editable-input" /></td>
                                                <td><input type="number" min="0" value={p.p_price?.single_price || 0} onChange={e => handleProductDetailChange(i, 'p_price', e.target.value)} className="editable-input" /></td>
                                                <td><input type="number" min="0" value={p.GST_rate || 0} onChange={e => handleProductDetailChange(i, 'GST_rate', e.target.value)} className="editable-input" /></td>
                                                <td className="qty-col"><input type="number" min="1" value={p.quantity} onChange={e => handleQuantityChange(i, e.target.value)} className="quantity-input" required /></td>
                                                <td className="total-price-col"><strong>{formatCurrency(p.totalPrice)}</strong></td>
                                                <td><button className="remove-btn" onClick={() => handleRemoveProduct(p._id)}><FiTrash2 size={16} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="grand-total"><strong>Grand Total: </strong>{formatCurrency(grandTotal)}</div>
                                <div className="modal-buttons">
                                    <button className="back-btn" onClick={onClose}><FiX size={18} style={{ marginRight: '6px' }} /> Close</button>
                                    <button className="generate-btn next-step-btn" onClick={() => setStep(2)} disabled={isListEmpty}>Proceed to Details <FiArrowRight size={18} style={{ marginLeft: '6px' }} /></button>
                                </div>
                            </>
                        )}
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="form-row">
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label>Search & Select Customer (Company / Phone)</label>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Start typing..."
                                    autoComplete="off"
                                />
                                {filteredCustomers.length > 0 && searchTerm.trim() && (
                                    <ul className="search-dropdown-list">
                                        {filteredCustomers.map(c => (
                                            <li key={c._id} onClick={() => handleSelectCustomer(c)}>
                                                {c.company} - {c.phone}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Quotation No.</label>
                                <input type="text" value={quotationNumber} onChange={e => setQuotationNumber(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label>Quotation Date</label>
                                <input type="date" value={quotationDate} onChange={e => setQuotationDate(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label>Customer Name *</label>
                                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label>Customer Address *</label>
                                <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label>Notes / Remarks</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="E.g., delivery location, warranty, etc."
                                />
                            </div>
                        </div>

                        <div className="modal-buttons">
                            <button className="back-btn" onClick={() => setStep(1)}>
                                <FiArrowLeft size={18} style={{ marginRight: '6px' }} /> Back to List
                            </button>
                            <button
                                className="generate-btn"
                                onClick={generatePDFAndSave}
                                disabled={!customerName.trim() || !customerAddress.trim()}
                            >
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
/* --- Modal Overlay --- */
.quotation-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(40, 50, 60, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
}

/* --- Modal Content --- */
.quotation-modal-content {
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
    background: #ffffff;
    border-radius: 12px;
    padding: 2.5rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    font-family: 'Outfit', sans-serif;
    border: 1px solid #e0e0e0;
    animation: modalScaleIn 0.3s ease-out;
}
@keyframes modalScaleIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
}

/* --- Modal Title --- */
.modal-title {
    font-size: 1.8rem;
    color: #334e68;
    margin-bottom: 2rem;
    text-align: center;
    font-weight: 600;
    letter-spacing: -0.01em;
}

hr {
    border: none;
    border-top: 1px solid #f0f0f0;
    margin: 1.5rem 0 !important;
}

/* --- Step Indicator --- */
.step-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-bottom: 30px;
}
.step {
    padding: 8px 18px;
    border-radius: 8px;
    font-weight: 500;
    color: #64748b;
    background: #f8fafc;
    font-size: 0.95rem;
    letter-spacing: 0;
    transition: all 0.2s ease;
    border: 1px solid #e5e7eb;
}
.step.active {
    background: #4f46e5;
    color: #fff;
    font-weight: 600;
    box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2);
    transform: none;
    border-color: #4f46e5;
}
.separator {
    color: #cbd5e1;
    font-size: 1.4rem;
}

/* --- Table Styles --- */
.quotation-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 1.5rem;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    border: 1px solid #e0e0e0;
}
.quotation-table thead {
    background: #4f46e5;
}
.quotation-table th {
    color: #fff;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 0.8rem 1rem;
    text-transform: none;
    letter-spacing: 0;
}
.quotation-table td {
    background: #fff;
    border-bottom: 1px solid #f5f5f5;
    padding: 0.8rem 1rem;
    text-align: left;
    font-size: 0.9rem;
    color: #4b5563;
    vertical-align: middle;
}
.quotation-table tr:hover td {
    background-color: #f7f9fc;
}
.quotation-table tr:last-child td {
    border-bottom: none;
}
.qty-col, .total-price-col {
    text-align: center;
}
.product-name {
    font-weight: 500;
    color: #334e68;
}
.quantity-input {
    width: 60px;
    padding: 0.4rem;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 500;
    background: #fcfcfc;
    transition: all 0.2s;
}
.quantity-input:focus {
    border-color: #4f46e5;
    outline: none;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
    background: #fff;
}
.grand-total {
    margin-top: 1.5rem;
    font-size: 1.3rem;
    text-align: right;
    font-weight: 600;
    color: #0f172a;
    padding: 1.2rem 0;
    border-top: 1px solid #e5e7eb;
    letter-spacing: 0;
}
.grand-total span {
    color: #b91c1c;
    font-weight: 700;
    margin-left: 10px;
}
.remove-btn {
    background: #fee2e2;
    color: #dc2626;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 500;
    border: 1px solid #fecaca;
    border-radius: 6px;
    transition: all 0.2s;
}
.remove-btn:hover {
    background: #fce7e7;
    transform: none;
    box-shadow: 0 1px 3px rgba(220, 38, 38, 0.1);
}

/* --- Form Styles --- */
.form-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
}

@media (max-width: 768px) {
    .form-row {
        grid-template-columns: 1fr;
    }
}

.form-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 1.5rem;
    gap: 0.4rem;
}
.form-group label {
    font-weight: 500;
    color: #4b5563;
    font-size: 0.95rem;
    margin-bottom: 0;
}
.form-group input,
.form-group textarea {
    padding: 0.8rem 1rem;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    font-family: inherit;
    font-size: 0.95rem;
    background: #fcfcfc;
    color: #1e293b;
    transition: all 0.2s;
}
.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    background: #fff;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
.form-group textarea {
    min-height: 100px;
}

/* --- Button Styles --- */
.modal-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2.5rem;
}
.generate-btn, .close-btn, .back-btn {
    border: none;
    font-size: 0.95rem;
    font-family: inherit;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
    letter-spacing: 0;
}

/* Primary Button (Generate PDF) */
.generate-btn {
    background: #10b981;
    color: #fff;
    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.2);
}
.generate-btn:hover {
    background: #059669;
    transform: none;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
.generate-btn:disabled {
    background: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
}

/* Secondary Button (Back) */
.back-btn {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    box-shadow: none;
}
.back-btn:hover {
    background: #e2e8f0;
    color: #334155;
    transform: none;
}
/* Tertiary Button (Close) */
.close-btn {
    background: transparent;
    color: #64748b;
    border: 1px solid #d1d5db;
    padding: 0.75rem 1.5rem;
}
.close-btn:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
    color: #334e68;
}

/* Empty State */
.empty-message {
    text-align: center;
    padding: 30px 20px;
    background: #fffbe6;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    margin-top: 15px;
    color: #92400e;
    font-size: 1rem;
    font-weight: 500;
}

/* Search Dropdown */
.search-dropdown-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    border: 1px solid #e5e7eb;
    max-height: 200px;
    overflow-y: auto;
    background: white;
    z-index: 10;
    padding: 0;
    margin: 5px 0 0 0;
    list-style: none;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.08);
}
.search-dropdown-list li {
    padding: 10px 15px;
    cursor: pointer;
    font-size: 0.95rem;
    border-bottom: 1px solid #f7f7f7;
    transition: background-color 0.2s;
}
.search-dropdown-list li:hover {
    background-color: #f5f3ff;
}
.search-dropdown-list li:last-child {
    border-bottom: none;
}
.search-dropdown-list li span {
    display: inline-block;
}
.search-dropdown-list li span:first-child {
    font-weight: 600;
    color: #4f46e5;
}
.search-dropdown-list li span:last-child {
    color: #64748b;
    margin-left: 10px;
}

.editable-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9rem;
    text-align: left;
    background: #fcfcfc;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.editable-input:focus {
    border-color: #4f46e5;
    outline: none;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
    background: #fff;
}

/* --- Mobile Responsiveness --- */
@media (max-width: 768px) {
    .quotation-modal-content {
        padding: 1.5rem 1rem;
    }
    .modal-title {
        font-size: 1.5rem;
    }
    .modal-buttons {
        flex-direction: column;
        align-items: stretch;
        gap: 0.6rem;
    }
    .generate-btn, .close-btn, .back-btn {
        width: 100%;
        padding: 0.9rem 1.5rem;
    }
    .quotation-table th,
    .quotation-table td {
        padding: 0.6rem 0.4rem;
        font-size: 0.8rem;
    }
    .quotation-table th:nth-child(3),
    .quotation-table td:nth-child(3),
    .quotation-table th:nth-child(4),
    .quotation-table td:nth-child(4) {
        display: none;
    }
    .step-indicator {
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
    }
    .separator {
        display: none;
    }
    .step {
        width: 100%;
        text-align: center;
    }
    .grand-total {
        font-size: 1.1rem;
        padding: 1rem 0;
    }
    .form-group input,
    .form-group textarea {
        padding: 0.6rem 0.8rem;
        font-size: 0.9rem;
    }
}
`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);