import React, { useState } from "react";
import axios from "axios";
import { logActivity } from "../../../utils/logActivity";
import { toast } from "react-toastify";
import CustomToast from "../CustomToast"; 

const CsvUploadModal = ({ onClose }) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [skippedData, setSkippedData] = useState(null);
  const [loading, setLoading] = useState(false); // New state

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage("");
    setSkippedData(null);
  };

  const handleUpload = async () => {
    if (!file) {
      return toast(
        <CustomToast type="error" title="No File Selected" message="Please select a CSV file to upload." />
      );
    }

    setLoading(true); // Start loading
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/upload-csv`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const { inserted, skipped, skippedData } = response.data;
      setMessage(`✅ Upload successful! Inserted: ${inserted}, Skipped: ${skipped}`);
      setSkippedData(skippedData);

      await logActivity("Uploaded CSV", {
        inserted,
        skipped,
        fileName: file.name,
      });

      toast(
        <CustomToast type="success" title="CSV Uploaded" message={`Inserted: ${inserted}, Skipped: ${skipped}`} />
      );

      setFile(null);
    } catch (error) {
      const msg = error.response?.data?.error || "Upload failed. Please try again.";
      setMessage(`❌ ${msg}`);
      toast(
        <CustomToast type="error" title="Upload Failed" message={msg} />
      );
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <div className="csv-modal-overlay" onClick={onClose}>
      <div className="csv-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="csv-modal-header">
          <h2 className="csv-modal-title">Upload CSV</h2>
          <button className="csv-close-btn" onClick={onClose}>✖</button>
        </div>

        <div className="csv-modal-body">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="csv-file-input"
          />
          <button 
            onClick={handleUpload} 
            disabled={!file || loading} 
            className="csv-upload-btn"
          >
            {loading ? "Uploading..." : "Upload"} {/* Button text changes */}
          </button>

          {message && <p className="csv-upload-message">{message}</p>}

          {skippedData && skippedData.length > 0 && (
            <div className="csv-skipped-data">
              <h3 className="csv-skipped-heading">Skipped Data:</h3>
              <div className="csv-skipped-table-wrapper">
                <table className="csv-skipped-table">
                  <thead>
                    <tr>
                      {Object.keys(skippedData[0]).map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {skippedData.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((val, idx) => (
                          <td key={idx}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CsvUploadModal;


const css = `
.csv-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.csv-modal-container {
  width: 650px;
  max-height: 90%;
  background: rgba(255, 255, 255, 0.87);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 2rem;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255,255,255,0.3);
  scroll-behavior: smooth;
}

/* Scrollbar styling */
.csv-modal-container::-webkit-scrollbar {
  width: 10px;
}
.csv-modal-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}
.csv-modal-container::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 2px solid rgba(200,200,200,0.2);
}
.csv-modal-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80,80,80,0.7);
}

/* Header */
.csv-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.csv-modal-title {
  font-size: 1.5rem;
  color: #313131ff;
}
.csv-close-btn {
  font-size: 1.2rem;
  color: #3b3b3bff;
  background: none;
  border: none;
  cursor: pointer;
}

/* Body */
.csv-modal-body {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.csv-file-input {
  padding: 0.5rem;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.2);
  background: rgba(255,255,255,0.9);
}

/* Buttons */
.csv-upload-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  background: rgba(23, 146, 23, 1);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s ease;
  max-width: 120px;
}
.csv-upload-btn:hover {
  background: rgba(18,120,18,0.95);
}

/* Message */
.csv-upload-message {
  font-size: 0.9rem;
  color: #000;
}

/* Skipped Data Table */
.csv-skipped-data {
  margin-top: 1rem;
  max-height: 250px;
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.1);
}
.csv-skipped-table-wrapper {
  overflow-x: auto;
}
.csv-skipped-table {
  width: 100%;
  border-collapse: collapse;
}
.csv-skipped-table th,
.csv-skipped-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  text-align: left;
  font-size: 0.85rem;
}
.csv-skipped-heading {
  margin-bottom: 0.5rem;
  color: #222;
  font-weight: 600;
} 
.csv-close-btn {
  font-size: 1.2rem;
  color: #3b3b3bff; 
  background: none;
  border: none;
  cursor: pointer;
}

.csv-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}
  
.csv-skipped-data {
  margin-top: 1rem;
  max-height: 250px;
  padding: 0.5rem;
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.1);
}
.csv-skipped-table-wrapper {
  overflow-x: auto;
}
.csv-skipped-table {
  width: 100%;
  border-collapse: collapse;
}
.csv-skipped-table th,
.csv-skipped-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  text-align: left;
  font-size: 0.85rem;
}
.csv-skipped-heading
  {
  margin-bottom: 0.5rem;
  color: #222;
  font-weight: 600;
}

/* Buttons */
.csv-upload-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  background: rgba(23,146,23,1);
  color: #fff;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  transition: background 0.2s ease;
  max-width: 120px;
}
.csv-upload-btn:hover {
  background: rgba(18,120,18,0.95);
}

/* Message */
.csv-upload-message {
  font-size: 0.9rem;
  color: #000;
}
`;        
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);