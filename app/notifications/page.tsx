import NotificationCenter from "@/components/NotificationCenter";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Notifications"};
export default function Notifications(){return <section className="page"><div className="pageHead"><span className="kicker">ALERTS · V16</span><h1>Notifications</h1><p className="muted">Updates for your favorite teams and saved players, generated automatically each day.</p></div><div className="cloudAccountFlag"><b>AUTOMATIC ALERTS</b><span>Daily checks run even when FourthDown is closed. Email and browser push follow your opt-in settings. Updates are scheduled, not instant.</span></div><NotificationCenter/></section>}
