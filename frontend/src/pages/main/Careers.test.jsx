import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Careers from "./Careers";

const renderCareers = () => render(
  <MemoryRouter>
    <Careers />
  </MemoryRouter>
);

const selectResume = (file) => {
  const input = screen.getByLabelText(/Resume Upload/);
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  fireEvent.change(input);
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Careers page", () => {
  it("shows all three vacancies and the specified application dates", () => {
    renderCareers();

    expect(screen.getByRole("heading", { name: "Build Your Career With Us" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Telemarketing Executive" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "E-commerce Executive" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "E-commerce Sales Executive" })).toBeInTheDocument();
    expect(screen.getByText("Applications Open: 10 November 2026")).toBeInTheDocument();
    expect(screen.getByText("Last Date to Apply: 30 November 2026")).toBeInTheDocument();
    expect(screen.getAllByText("10 Nov – 30 Nov 2026")).toHaveLength(3);
  });

  it("preselects the selected job when applying from a vacancy card", () => {
    renderCareers();
    const jobCard = screen.getByRole("heading", { name: "E-commerce Executive" }).closest("article");

    fireEvent.click(within(jobCard).getByRole("button", { name: /Apply Now/ }));

    expect(screen.getByLabelText(/Position Applying For/)).toHaveValue("E-commerce Executive");
  });

  it("rejects unsupported resume formats", () => {
    renderCareers();
    const file = new File(["not a resume"], "resume.exe", { type: "application/octet-stream" });

    fireEvent.change(screen.getByLabelText(/Resume Upload/), { target: { files: [file] } });

    expect(screen.getByText("Upload your resume as a PDF, DOC, or DOCX file.")).toBeInTheDocument();
  });

  it("rejects resumes larger than 5 MB", () => {
    renderCareers();
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "resume.pdf", { type: "application/pdf" });

    selectResume(file);

    expect(screen.getByText("Your resume must be 5 MB or smaller.")).toBeInTheDocument();
  });

  it("rejects an invalid mobile number before making a request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCareers();

    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: "Asha Applicant" } });
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile Number/), { target: { value: "12345" } });
    fireEvent.change(screen.getByLabelText(/Position Applying For/), { target: { value: "Telemarketing Executive" } });
    fireEvent.change(screen.getByLabelText(/Current Location/), { target: { value: "New Delhi" } });
    fireEvent.change(screen.getByLabelText(/Total Experience/), { target: { value: "2 years" } });
    selectResume(new File(["sample"], "resume.pdf", { type: "application/pdf" }));
    const form = screen.getByRole("button", { name: /Submit Application/ }).closest("form");
    form.reportValidity = () => true;
    fireEvent.submit(form);

    expect(screen.getByText("Enter a valid mobile number with 10 to 15 digits.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits a multipart application only after validation and a successful endpoint response", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    vi.stubEnv("VITE_API_URL", "https://mfglobalservices.com/api");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "Application received." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderCareers();

    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: "Asha Applicant" } });
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile Number/), { target: { value: "+91 98765 43210" } });
    fireEvent.change(screen.getByLabelText(/Position Applying For/), { target: { value: "Telemarketing Executive" } });
    fireEvent.change(screen.getByLabelText(/Current Location/), { target: { value: "New Delhi" } });
    fireEvent.change(screen.getByLabelText(/Total Experience/), { target: { value: "2 years" } });
    const resume = new File(["sample"], "resume.pdf", { type: "application/pdf" });
    selectResume(resume);
    fireEvent.change(screen.getByLabelText(/Cover Letter/), { target: { value: "I am interested in the position." } });
    const form = screen.getByRole("button", { name: /Submit Application/ }).closest("form");
    form.reportValidity = () => true;
    fireEvent.submit(form);

    expect(await screen.findByText("Application received.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mfglobalservices.com/api/careers/apply",
      expect.objectContaining({ method: "POST", credentials: "omit", body: expect.any(FormData) })
    );
    const submitted = fetchMock.mock.calls[0][1].body;
    expect(submitted.get("position")).toBe("Telemarketing Executive");
    expect(submitted.get("resume").name).toBe("resume.pdf");
    await waitFor(() => expect(screen.getByLabelText(/Full Name/)).toHaveValue(""));
  });

  it("does not claim success when the endpoint is not configured", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    vi.stubEnv("VITE_API_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCareers();

    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: "Asha Applicant" } });
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile Number/), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/Position Applying For/), { target: { value: "Telemarketing Executive" } });
    fireEvent.change(screen.getByLabelText(/Current Location/), { target: { value: "New Delhi" } });
    fireEvent.change(screen.getByLabelText(/Total Experience/), { target: { value: "2 years" } });
    selectResume(new File(["sample"], "resume.pdf", { type: "application/pdf" }));
    const form = screen.getByRole("button", { name: /Submit Application/ }).closest("form");
    form.reportValidity = () => true;
    fireEvent.submit(form);

    expect(await screen.findByText(/application service is not configured/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
