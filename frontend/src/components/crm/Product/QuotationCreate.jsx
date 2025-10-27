import React, { useState, useEffect } from "react";
import { AiOutlineDelete } from 'react-icons/ai';
import AddClientModal from "./AddClientModal";
import AddItemModal from "./AddItemModal";
import "./styles/QuotationCreate.css";
import ShipToModal from "./ShipToModal";
import axios from "axios";
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';
import { generateQuotationPDF } from "../../../utils/quotationPdf";

const initialBankDetails = {
    accountNumber: "9549850787",
    ifscCode: "KKBK0000176",
    bankName: "Kotak Mahindra Bank, NFC NEW DELHI",
    accountHolder: "MF Global Services",
    upiId: "8750708222-1@okbizaxis",
};

const user = JSON.parse(localStorage.getItem('user'));

const initialTerms = `Payment Terms: 70% Advance at the time of order, Rest Amount at the time of Delivery.\nDelivery Time: 7-10 days.\nLogistic Cost extra as per transportation.`;

const QuotationCreate = () => {

    const [party, setParty] = useState(null);
    const [items, setItems] = useState([]);
    const [isEditingTerms, setIsEditingTerms] = useState(false);
    const [terms, setTerms] = useState(initialTerms);
    const [bankDetails, setBankDetails] = useState(initialBankDetails);
    const [notes, setNotes] = useState("");
    const [notesEditing, setNotesEditing] = useState(false);
    const [editingBank, setEditingBank] = useState(false);



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


    const handleSaveQuotation = async () => {
        if (!party) {
            toast(
                <CustomToast
                    type="error"
                    title="Client Missing"
                    message="Please add a client first!"
                />
            );
            return;
        }

        if (!items || items.length === 0) {
            toast(
                <CustomToast
                    type="error"
                    title="No Items"
                    message="Please add at least one item!"
                />
            );
            return;
        }

        try {
            const token = localStorage.getItem("token");

            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/quotations/create`,
                {
                    party,
                    items,
                    terms,
                    notes,
                    bankDetails,
                    invoiceDetails,
                    summary,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            toast(
                <CustomToast
                    type="success"
                    title="Quotation Saved"
                    message={`Quotation "${response.data._id}" saved successfully!`}
                />
            );

            console.log("Saved Quotation:", response.data);

            generateQuotationPDF(
                { party, items, terms, bankDetails, invoiceDetails, summary }
              );

        } catch (err) {
            console.error(err);
            toast(
                <CustomToast
                    type="error"
                    title="Save Failed"
                    message="Failed to save quotation. Please try again."
                />
            );
        }
    };

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
                    <button className="save-btn" onClick={handleSaveQuotation} >Save Quotation</button>
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
                                <p>Phone Number: {party.phone}</p>
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

            <div className="qtn-items-section">
                <table className="qtn-quotation-table">
                    <thead>
                        <tr>
                            <th className="qtn-no">No</th>
                            <th className="qtn-items-services">Products</th>
                            <th className="qtn-hsn-sac">HSN</th>
                            <th className="qtn-qty">Qty</th>
                            <th className="qtn-price">Price/Item (₹)</th>
                            <th className="qtn-discount">Discount</th>
                            <th className="qtn-tax">GST%</th>
                            <th className="qtn-amount">Amount (₹)</th>
                            <th className="qtn-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 &&
                            items.map((item, index) => {
                                const itemCalc = calculateItemAmount(item);

                                return (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <div className="qtn-item-name-box">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) =>
                                                        setItems((prev) =>
                                                            prev.map((it, i) =>
                                                                i === index ? { ...it, name: e.target.value } : it
                                                            )
                                                        )
                                                    }
                                                    className="qtn-item-input"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Enter Description (optional)"
                                                    value={item.description || ""}
                                                    onChange={(e) =>
                                                        setItems((prev) =>
                                                            prev.map((it, i) =>
                                                                i === index ? { ...it, description: e.target.value } : it
                                                            )
                                                        )
                                                    }
                                                    className="qtn-item-description-input"
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.hsn || ""}
                                                onChange={(e) =>
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === index ? { ...it, hsn: e.target.value } : it
                                                        )
                                                    )
                                                }
                                                className="qtn-item-input"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.qty}
                                                onChange={(e) =>
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === index ? { ...it, qty: Number(e.target.value) } : it
                                                        )
                                                    )
                                                }
                                                className="qtn-item-input qtn-input-qty"
                                            />{" "}
                                            PCS
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.price}
                                                onChange={(e) =>
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === index ? { ...it, price: Number(e.target.value) } : it
                                                        )
                                                    )
                                                }
                                                className="qtn-item-input qtn-input-price"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.discount}
                                                onChange={(e) =>
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === index ? { ...it, discount: Number(e.target.value) } : it
                                                        )
                                                    )
                                                }
                                                className="qtn-item-input qtn-input-disc"
                                            />%
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.tax}
                                                onChange={(e) =>
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === index ? { ...it, tax: Number(e.target.value) } : it
                                                        )
                                                    )
                                                }
                                                className="qtn-item-input qtn-input-tax"
                                            />%
                                            <p className="qtn-tax-breakdown">(₹ {itemCalc.taxAmount.toFixed(2)})</p>
                                        </td>
                                        <td className="qtn-amount-cell">{itemCalc.total.toFixed(2)}</td>
                                        <td className="qtn-actions-cell">
                                            <button
                                                className="qtn-delete-item-btn"
                                                onClick={() => handleRemoveItem(index)}
                                            >
                                                <AiOutlineDelete className="icon-del" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                        {/* Add Item Row */}
                        <tr className="qtn-input-row">
                            <td colSpan="2">
                                <button
                                    className="qtn-create-item-btn"
                                    onClick={() => setShowItemModal(true)}
                                >
                                    + Create Item
                                </button>
                            </td>
                            <td></td>
                            <td>
                                <span className="qtn-free-qty-link">+ Free Qty</span>
                            </td>
                            <td colSpan="3"></td>
                            <td>
                                <i
                                    className="fas fa-plus qtn-add-item-icon"
                                    onClick={() => setShowItemModal(true)}
                                ></i>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {/* Totals, Terms, and Bank Details */}
            <div className="bottom-sections-grid">
                {/* LEFT SIDE */}
                <div className="left-column">
                    {/* Terms & Conditions */}
                    <div className="editable-section">
                        <div className="section-header">
                            <h4>Terms & Conditions</h4>
                            <button
                                className="edit-btn"
                                onClick={() => setIsEditingTerms(!isEditingTerms)}
                            >
                                {isEditingTerms ? "Save" : "Edit"}
                            </button>
                        </div>

                        {isEditingTerms ? (
                            <textarea
                                className="editable-textarea"
                                rows="4"
                                value={terms}
                                onChange={(e) => setTerms(e.target.value)}
                            />
                        ) : (
                            <p className="section-content">
                                {terms.split("\n").map((line, i) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        {i < terms.split("\n").length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="editable-section">
                        <div className="section-header">
                            <h4>Additional Notes</h4>
                            <button
                                className="edit-btn"
                                onClick={() => setNotesEditing((prev) => !prev)}
                            >
                                {notesEditing ? "Save" : "Add Note"}
                            </button>
                        </div>
                        {notesEditing ? (
                            <textarea
                                className="editable-textarea"
                                rows="3"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        ) : notes ? (
                            <p className="section-content">{notes}</p>
                        ) : (
                            <p className="placeholder-text">No notes added yet.</p>
                        )}
                    </div>

                    {/* Bank Details */}
                    <div className="editable-section">
                        <div className="section-header">
                            <h4>Bank Details</h4>
                            <button
                                className="edit-btn"
                                onClick={() => setEditingBank(!editingBank)}
                            >
                                {editingBank ? "Save" : "Edit"}
                            </button>
                        </div>

                        {editingBank ? (
                            <div className="bank-edit-grid">
                                <input
                                    type="text"
                                    placeholder="Account Holder Name"
                                    value={bankDetails.accountHolder}
                                    onChange={(e) =>
                                        setBankDetails({ ...bankDetails, accountHolder: e.target.value })
                                    }
                                />
                                <input
                                    type="text"
                                    placeholder="Account Number"
                                    value={bankDetails.accountNumber}
                                    onChange={(e) =>
                                        setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                                    }
                                />
                                <input
                                    type="text"
                                    placeholder="IFSC Code"
                                    value={bankDetails.ifscCode}
                                    onChange={(e) =>
                                        setBankDetails({ ...bankDetails, ifscCode: e.target.value })
                                    }
                                />
                                <input
                                    type="text"
                                    placeholder="Bank & Branch Name"
                                    value={bankDetails.bankName}
                                    onChange={(e) =>
                                        setBankDetails({ ...bankDetails, bankName: e.target.value })
                                    }
                                />
                                <input
                                    type="text"
                                    placeholder="UPI ID"
                                    value={bankDetails.upiId}
                                    onChange={(e) =>
                                        setBankDetails({ ...bankDetails, upiId: e.target.value })
                                    }
                                />
                            </div>
                        ) : (
                            <div className="bank-display">
                                <p><strong>{bankDetails.accountHolder}</strong></p>
                                <p>Account No: {bankDetails.accountNumber}</p>
                                <p>IFSC: {bankDetails.ifscCode}</p>
                                <p>{bankDetails.bankName}</p>
                                <p>UPI: {bankDetails.upiId}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="right-column">
                    <div className="summary-card">
                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>₹{totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Tax (IGST)</span>
                            <span>₹{totals.tax.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Discount</span>
                            <div className="summary-inline">
                                <input
                                    type="number"
                                    name="discount"
                                    value={summary.discount}
                                    onChange={handleSummaryChange}
                                />
                                <select
                                    name="discountType"
                                    value={summary.discountType}
                                    onChange={handleSummaryChange}
                                >
                                    <option value="%">%</option>
                                    <option value="₹">₹</option>
                                </select>
                            </div>
                        </div>
                        <div className="summary-row">
                            <span>Additional Charges</span>
                            <input
                                type="number"
                                name="additionalCharges"
                                value={summary.additionalCharges}
                                onChange={handleSummaryChange}
                            />
                        </div>

                        <hr />

                        <div className="summary-row total-row">
                            <strong>Total</strong>
                            <strong>₹{finalTotal.toFixed(2)}</strong>
                        </div>

                        <div className="summary-row">
                            <label>Amount Received</label>
                            <input
                                type="number"
                                name="amountReceived"
                                value={summary.amountReceived}
                                onChange={handleSummaryChange}
                            />
                        </div>

                        <div className="summary-row balance-row">
                            <strong>Balance</strong>
                            <strong>₹{balanceAmount.toFixed(2)}</strong>
                        </div>
                    </div>

                    <div className="signatory">
                        Authorized Signatory for <strong>{bankDetails.accountHolder}</strong>
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