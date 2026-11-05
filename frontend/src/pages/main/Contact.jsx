import React from 'react';
import  Navbar from "../../components/main/Navbar";
import Footer from "../../components/main/Footer";
import ContactUs from "../../components/main/ContactUs"
import PopularCategories from '../../components/main/PopularCategories';
import useMarketingMeta from "./useMarketingMeta";
import "../../styles/main/MarketingSite.css";

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