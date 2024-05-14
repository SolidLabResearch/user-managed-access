import { useEffect, useState } from "react";
import PolicyPage from "./PolicyPage";
import BasicTabs from "./Tabs";

export default function Home() { 


    return (
        <div id="page-wrapper">
            <div id="page-container" className="rowcontainer">
                <BasicTabs />
            </div>
        </div>
    )
}
