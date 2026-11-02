export const metadata = {
  title: 'Privacy and cancellation – Uni Boost'
};

export default function Privacy() {
  return (
    <main className="wrap">
      <section className="page-hero">
        <p className="crumbs"><a href="/">Home</a> / Privacy</p>
        <h1>Privacy and <span className="accent">cancellation</span></h1>
        <p className="sub">What Uni Boost keeps when you book a class, and how to cancel.</p>
      </section>
      <div className="panel" style={{ marginBottom: 80 }}>
        <h2>What we collect</h2>
        <p>A booking stores your name, phone number, email if you add one, university, the subject, and a 6 to 10 digit access code. If you pay by InstaPay, we also store the transfer reference and the screenshot you upload.</p>
        <p>We use those details to hold your seat, confirm the payment, and show you the class link, materials, and recording in My Classes. We do not sell them.</p>
        <h2>Access code</h2>
        <p>The access code stays in this browser only until you close the tab. Your phone number can stay on the device so the form is easier to fill next time. On the live site the access code is stored as a hash, so the database does not keep the digits you typed.</p>
        <h2>Class times</h2>
        <p>Every class time is Egypt time (Africa/Cairo), including for students opening the site from another country.</p>
        <h2>Cancellation</h2>
        <p>You can cancel an upcoming class from My Classes before it starts. A payment marked pending has not been confirmed yet. After Uni Boost confirms a payment, a refund is only arranged if you cancel before the class starts and we agree to return it. InstaPay transfers are checked by hand, so a confirmation can take some time.</p>
      </div>
    </main>
  );
}
