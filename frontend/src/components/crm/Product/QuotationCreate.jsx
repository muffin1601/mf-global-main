import React, { useState, useEffect } from "react";

import AddClientModal from "./AddClientModal";
import AddItemModal from "./AddItemModal";
import "./styles/QuotationCreate.css"; 
import ShipToModal from "./ShipToModal";

const initialBankDetails = {
    accountNumber: "9549850787",
    ifscCode: "KKBK0000176",
    bankName: "Kotak Mahindra Bank, NFC NEW DELHI",
    accountHolder: "MF Global Services",
    upiId: "8750708222-1@okbizaxis",
};

const initialTerms = `Payment Terms: 70% Advance at the time of order, Rest Amount at the time of Delivery.\nDelivery Time: 7-10 days.\nLogistic Cost extra as per transportation.`;

const QuotationCreate = () => {

    const [party, setParty] = useState(null);
    const [items, setItems] = useState([]);
    const [isEditingTerms, setIsEditingTerms] = useState(false);
    const [terms, setTerms] = useState(initialTerms);
    const [bankDetails, setBankDetails] = useState(initialBankDetails);


    const [invoiceDetails, setInvoiceDetails] = useState({
        prefix: "MF/Q/25-26/",
        number: "1571",
        date: new Date().toISOString().substring(0, 10),
        validityDays: "30",
        validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        poNo: "",
        placeOfSupply: "Uttar Pradesh",
    });


    const [summary, setSummary] = useState({
        discount: 0,
        discountType: '%',
        additionalCharges: 0,
        applyTCS: false,
        autoRoundOff: false,
        roundOffSign: '+',
        roundOffAmount: 0,
        amountReceived: 0,
        paymentMethod: 'Cash',
    });


    const [showPartyModal, setShowPartyModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [showShipToModal, setShowShipToModal] = useState(false);

    useEffect(() => {
        const days = parseInt(invoiceDetails.validityDays);
        if (!isNaN(days) && days >= 0) {
            const date = new Date(invoiceDetails.date);
            date.setDate(date.getDate() + days);
            setInvoiceDetails(prev => ({ ...prev, validityDate: date.toISOString().substring(0, 10) }));
        }
    }, [invoiceDetails.validityDays, invoiceDetails.date]);


    useEffect(() => {
        if (party && party.state && invoiceDetails.placeOfSupply !== party.state) {
            setInvoiceDetails(prev => ({ ...prev, placeOfSupply: party.state }));
        }
    }, [party]);


    const formatAddress = (addr) => {
        if (!addr) return "";
        return `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''}, ${addr.postalCode || ''}, ${addr.country || ''}`;
    };

    const handleAddParty = (clientData = {}) => {
        const billAddress = formatAddress(clientData.billingAddress);
        const shipAddress = clientData.shippingAddress ? formatAddress(clientData.shippingAddress) : billAddress;
        const state = clientData.billingAddress?.state || clientData.state || "Uttar Pradesh";

        const shippingAddresses = [
            { name: "Billing Address", address: billAddress, state },
        ];

        if (clientData.shippingAddress) {
            shippingAddresses.push({
                name: "Shipping Address",
                address: shipAddress,
                state: clientData.shippingAddress.state || state,
            });
        }

        setParty({
            name: clientData.contact || clientData.name || clientData.company || "Unnamed Contact",
            company: clientData.company || "Unnamed Company",
            phone: clientData.phone || "—",
            billToAddress: billAddress,
            state: state,
            pan: "AAZC598139F",
            shippingAddresses: shippingAddresses,
            selectedShippingAddress: shippingAddresses[0],
        });

        setShowPartyModal(false);
    };
    const handleSelectShippingAddress = (addressObject) => {
        setParty(prev => ({ ...prev, selectedShippingAddress: addressObject }));
        setShowShipToModal(false);
    };

    const handleAddItem = (itemData) => {
        setItems((prev) => [...prev, itemData]);
        setShowItemModal(false);
    };


    const handleRemoveItem = (index) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleDetailChange = (e) => {
        const { name, value } = e.target;
        setInvoiceDetails(prev => ({ ...prev, [name]: value }));
    };

    const handleSummaryChange = (e) => {
        const { name, type, checked, value } = e.target;
        setSummary(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };


    const calculateItemAmount = (item) => {
        const amount = item.qty * item.price;
        const discountAmount = amount * (item.discount / 100);
        const taxableValue = amount - discountAmount;
        const taxRate = item.tax || 0;
        const taxAmount = taxableValue * (taxRate / 100);

        return {
            taxableValue: taxableValue,
            taxAmount: taxAmount,
            total: taxableValue + taxAmount
        };
    };

    const totals = items.reduce((acc, item) => {
        const itemCalc = calculateItemAmount(item);
        acc.subtotal += itemCalc.taxableValue;
        acc.tax += itemCalc.taxAmount;
        return acc;
    }, { subtotal: 0, tax: 0 });

    const summaryDiscount = summary.discountType === '%'
        ? totals.subtotal * (parseFloat(summary.discount) / 100)
        : parseFloat(summary.discount);

    let preRoundTotal = totals.subtotal + totals.tax + parseFloat(summary.additionalCharges) - summaryDiscount;

    const roundOff = summary.autoRoundOff
        ? (summary.roundOffSign === '+' ? parseFloat(summary.roundOffAmount) : -parseFloat(summary.roundOffAmount))
        : 0;

    const finalTotal = preRoundTotal + roundOff;
    const balanceAmount = finalTotal - parseFloat(summary.amountReceived);



    return (
        <div className="quotation-container">
            <div className="quotation-header">
                <h3>Create Sales Quotation</h3>
                <div className="header-actions">
                    {/* <button className="settings-btn"><i className="fas fa-cog"></i> Settings</button> */}
                    <button className="save-btn">Save Quotation</button>
                </div>
            </div>
            <div className="quotation-meta-section">
                <div className="meta-row">
                    <label>Prefix:</label>
                    <input type="text" name="prefix" value={invoiceDetails.prefix} onChange={handleDetailChange} className="input-small" />
                </div>
                <div className="meta-row">
                    <label>Number:</label>
                    <input type="text" name="number" value={invoiceDetails.number} onChange={handleDetailChange} className="input-small" />
                </div>
                <div className="meta-row">
                    <label>Date:</label>
                    <input type="date" name="date" value={invoiceDetails.date} onChange={handleDetailChange} className="input-small" />
                </div>
                <div className="meta-row validity">
                    <label>Validity:</label>
                    <input type="number" name="validityDays" value={invoiceDetails.validityDays} onChange={handleDetailChange} className="input-tiny" />
                    <span className="days-label">days</span>
                    <input type="date" name="validityDate" value={invoiceDetails.validityDate} onChange={handleDetailChange} className="input-small" />
                </div>
                <div className="meta-row">
                    <label>PO No:</label>
                    <input type="text" name="poNo" value={invoiceDetails.poNo} onChange={handleDetailChange} className="input-small" />
                </div>
            </div>
            <div className="invoice-details-grid">

                <div className="billto-section">
                    <div className="party-header">
                        <h4>Bill To</h4>
                        {party && <span className="change-link" onClick={() => setShowPartyModal(true)}>Change Party</span>}
                    </div>
                    <div className="billto-box" onClick={() => !party && setShowPartyModal(true)}>
                        {party ? (
                            <div className="party-info">

                                <strong>{party.company || party.name}</strong>
                                <p>Phone Number: {party.phone}</p>
                                <p>ADDRESS: {party.billToAddress}</p>
                                {/* <p>PAN Number: {party.pan}</p> */}
                                <hr style={{ margin: '5px 0' }} />

                                <p style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Ship To:</p>
                                <p style={{ fontSize: '0.8em' }}>
                                    {party.selectedShippingAddress.address}
                                    (State: {party.selectedShippingAddress.state})
                                </p>
                            </div>
                        ) : (
                            <span className="add-party-text">+ Add Client</span>
                        )}
                    </div>
                </div>


                <div className="shipto-section">
                    <div className="party-header">
                        <h4>Ship To</h4>

                        {party && <span className="change-link" onClick={() => setShowShipToModal(true)}>Change Shipping Address ({party.shippingAddresses.length} options)</span>}
                    </div>
                    <div className="shipto-box">

                        {party && party.selectedShippingAddress ? (
                            <div className="party-info">
                                <strong>{party.selectedShippingAddress.name}</strong>
                                <p>ADDRESS: {party.selectedShippingAddress.address}</p>
                                <p>State: {party.selectedShippingAddress.state}</p>
                            </div>
                        ) : (
                            <span className="add-party-text-small">Not set (Same as Bill To)</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="place-of-supply">
                <label>Place of Supply</label>
                <input
                    type="text"
                    name="placeOfSupply"
                    value={invoiceDetails.placeOfSupply}
                    onChange={handleDetailChange}
                    className="input-medium"
                    placeholder="Enter Place of Supply"
                />
            </div>

            {/* Items Table */}
            <div className="items-section">
                <table className="quotation-table">
                    <thead>
                        <tr>
                            <th className="no">No</th>
                            <th className="items-services">Items / Services</th>
                            <th className="hsn-sac">HSN/SAC</th>
                            <th className="qty">Qty</th>
                            <th className="price">Price/Item (₹)</th>
                            <th className="discount">Discount</th>
                            <th className="tax">Tax</th>
                            <th className="amount">Amount (₹)</th>
                            <th className="actions"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 && items.map((item, index) => {
                            const itemCalc = calculateItemAmount(item);
                            return (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>
                                        <div className="item-name-box">
                                            {item.name}
                                            <input type="text" value={item.description || "Enter Description (optional)"} className="item-description-input" disabled />
                                        </div>
                                    </td>
                                    <td><input type="text" value={item.hsn || "-"} className="item-input" /></td>
                                    <td><input type="number" value={item.qty} className="item-input input-qty" /> PCS</td>
                                    <td><input type="number" value={item.price.toFixed(2)} className="item-input input-price" /></td>
                                    <td><input type="number" value={item.discount || 0} className="item-input input-disc" />%</td>
                                    <td>
                                        <input type="number" value={item.tax || 0} className="item-input input-tax" />%
                                        <p className="tax-breakdown">(₹ {itemCalc.taxAmount.toFixed(2)})</p>
                                    </td>
                                    <td className="amount-cell">{itemCalc.total.toFixed(2)}</td>
                                    <td className="actions-cell">
                                        <i className="fas fa-trash-alt delete-item" onClick={() => handleRemoveItem(index)}></i>
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Add Item Row */}
                        <tr className="input-row">
                            <td colSpan="2">
                                <button className="create-item-btn" onClick={() => setShowItemModal(true)}>+ Create Item</button>
                            </td>
                            <td></td>
                            <td><span className="free-qty-link">+ Free Qty</span></td>
                            <td colSpan="3"></td>
                            <td><i className="fas fa-qrcode scan-barcode"></i> Scan Barcode</td>
                            <td><i className="fas fa-plus add-item-icon" onClick={() => setShowItemModal(true)}></i></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Totals, Terms, and Bank Details */}
            <div className="bottom-sections-grid">
                <div className="left-column">
                    <div className="notes-terms">
                        <div className="section-header">
                            <h4>Terms and Conditions</h4>
                            <i className="fas fa-edit edit-icon" onClick={() => setIsEditingTerms(!isEditingTerms)}></i>
                        </div>
                        {isEditingTerms ? (
                            <textarea
                                value={terms}
                                onChange={(e) => setTerms(e.target.value)}
                                onBlur={() => setIsEditingTerms(false)}
                                className="terms-textarea"
                                rows="4"
                            />
                        ) : (
                            <p className="terms-text" onClick={() => setIsEditingTerms(true)}>
                                {terms.split('\n').map((line, index) => (
                                    <React.Fragment key={index}>
                                        {line}
                                        {index < terms.split('\n').length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </p>
                        )}
                        <div className="add-notes-link">+ Add Notes</div>
                    </div>

                    <div className="bank-details-section">
                        <h4>Bank Details</h4>
                        <div className="bank-info-box">
                            <strong>Account Number:</strong> {bankDetails.accountNumber} <br />
                            <strong>IFSC Code:</strong> {bankDetails.ifscCode} <br />
                            <strong>Bank & Branch Name:</strong> {bankDetails.bankName} <br />
                            <strong>Account Holder's Name:</strong> {bankDetails.accountHolder} <br />
                            <strong>UPI ID:</strong> {bankDetails.upiId}
                        </div>
                        <div className="bank-actions">
                            <span className="change-link" onClick={() => console.log('Open Bank Account Edit Modal')}>Change Bank Account</span>
                            <span className="remove-link" onClick={() => setBankDetails({})}>Remove Bank Account</span>
                        </div>
                    </div>
                </div>

                <div className="right-column">
                    <div className="summary-calculations">
                        <div className="summary-row subtotal-row">
                            <span>SUBTOTAL</span>
                            <span>₹{totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="summary-row tax-row">
                            <span>IGST@5%</span>
                            <span>₹{totals.tax.toFixed(2)}</span>
                        </div>
                        <div className="summary-row discount-row">
                            <span className="add-link">+ Add Discount</span>
                            <input type="number" name="discount" value={summary.discount} onChange={handleSummaryChange} className="input-tiny right-align" />
                            <select name="discountType" value={summary.discountType} onChange={handleSummaryChange} className="select-tiny">
                                <option>%</option>
                                <option>₹</option>
                            </select>
                        </div>
                        <div className="summary-row charges-row">
                            <span className="add-link">+ Add Additional Charges</span>
                            <input type="number" name="additionalCharges" value={summary.additionalCharges} onChange={handleSummaryChange} className="input-tiny right-align" />
                        </div>

                        <div className="summary-row check-row">
                            <span>Taxable Amount</span>
                            <span>₹{totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="summary-row check-row">
                            <input type="checkbox" name="applyTCS" checked={summary.applyTCS} onChange={handleSummaryChange} />
                            <label>Apply TCS</label>
                        </div>
                        <div className="summary-row check-row">
                            <input type="checkbox" name="autoRoundOff" checked={summary.autoRoundOff} onChange={handleSummaryChange} />
                            <label>Auto Round Off</label>
                            <span className="round-off-options">
                                <select name="roundOffSign" value={summary.roundOffSign} onChange={handleSummaryChange} className="select-tiny">
                                    <option value="+">+ Add</option>
                                    <option value="-">- Subtract</option>
                                </select>
                                <input type="number" name="roundOffAmount" value={summary.roundOffAmount} onChange={handleSummaryChange} className="input-tiny right-align" />
                            </span>
                        </div>
                    </div>

                    <div className="total-amount-box">
                        <span>Total Amount</span>
                        <span className="final-total">₹{finalTotal.toFixed(2)}</span>
                    </div>

                    <div className="amount-received-section">
                        <div className="input-group">
                            <label>Amount Received</label>
                            <input type="number" name="amountReceived" value={summary.amountReceived} onChange={handleSummaryChange} className="input-medium" />
                            <select name="paymentMethod" value={summary.paymentMethod} onChange={handleSummaryChange} className="select-tiny">
                                <option>Cash</option>
                                <option>Bank</option>
                                <option>UPI</option>
                            </select>
                            <span className="mark-paid-link">Mark as fully paid</span>
                        </div>
                        <div className="balance-row">
                            <span>Balance Amount</span>
                            <span className="balance-amount">₹{balanceAmount.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="signatory">
                        Authorized signatory for <strong>{bankDetails.accountHolder || 'Your Company Name'}</strong>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showPartyModal && (
                <AddClientModal
                    isOpen={showPartyModal}
                    onClose={() => setShowPartyModal(false)}
                    onSelect={handleAddParty}
                />
            )}

            {showItemModal && (
                <AddItemModal
                    onClose={() => setShowItemModal(false)}
                    onSave={handleAddItem}
                />
            )}

            {showShipToModal && party && (
                <ShipToModal
                    isOpen={showShipToModal}
                    onClose={() => setShowShipToModal(false)}
                    addresses={party.shippingAddresses}
                    onSelect={handleSelectShippingAddress}
                />
            )}
        </div>
    );
};

export default QuotationCreate;