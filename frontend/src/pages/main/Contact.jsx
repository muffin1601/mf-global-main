import React from 'react';
import  Navbar from "../../components/main/Navbar";
import Footer from "../../components/main/Footer";
import ContactUs from "../../components/main/ContactUs"
import PopularCategories from '../../components/main/PopularCategories';

export const Contact = () => {
    return (
        <>
        <Navbar/>
        <ContactUs/>
        <PopularCategories/>
        <Footer/>
        </>
    )
}

export default Contact;