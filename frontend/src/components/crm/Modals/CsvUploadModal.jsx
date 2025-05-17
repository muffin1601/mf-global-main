import React, { useState } from "react";
import axios from "axios";
import { logActivity } from "../../../utils/logActivity"; // Adjust path as needed
import "./styles/CsvUploadModal.css"; // optional styling file

const CsvUploadModal = ({ onClose }) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [skippedData, setSkippedData] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage("");
    setSkippedData(null);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file!");
      return;
    }

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

      setFile(null);
    } catch (error) {
      const msg = error.response?.data || "Upload failed. Please try again.";
      setMessage(`❌ ${msg}`);
    }
  };

  return (
    <div className="form-modal-overlay" onClick={onClose}>
      <div className="form-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="form-modal-header">
          <h2 className="form-modal-title">Upload CSV</h2>
          <button className="btn-close-form" onClick={onClose}>✖</button>
        </div>

        <div className="csv-upload-modal">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
          />
          <button onClick={handleUpload} disabled={!file} className="submit-form-btn">
            Upload
          </button>
          {message && <p className="upload-csv-message">{message}</p>}

          {skippedData && skippedData.length > 0 && (
            <div className="upload-csv-skipped-data">
              <h3 className="heading-skip">Skipped Data:</h3>
              <table>
                <thead>
                  <tr className="skip-data-tr">
                    {Object.keys(skippedData[0]).map((key) => (
                      <th className="skip-data-th"key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skippedData.map((row, index) => (
                    <tr className="skip-data-tr" key={index}>
                      {Object.values(row).map((value, idx) => (
                        <td className="skip-data-td"key={idx}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CsvUploadModal;
