"use client";
import React from 'react';
import  Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ContactUs from "../components/ContactUs"
import PopularCategories from '../components/PopularCategories';
import useMarketingMeta from "./useMarketingMeta";
import "../styles/MarketingSite.css";

export const Contact = () => {
    useMarketingMeta(
        "Contact Us | MF Global Services",
        "Contact MF Global Services to discuss corporate gifting, digital marketing, and website development."
    );

    return (
        <div className="marketing-site">
        <Navbar/>
        <main>
        <ContactUs/>
        <PopularCategories/>
        </main>
        <Footer/>
        </div>
    )
}

export default Contact;