const LINKS = [
  ['Home', '/'],
  ['Instructors', '/instructors'],
  ['Courses', '/courses'],
  ['Schedule', '/schedule'],
  ['My Classes', '/my-classes'],
  ['Recordings', '/recordings'],
  ['Dashboard', '/dashboard']
];

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <a href="/" className="logo"><i>U</i>Uni Boost</a>
          <nav>{LINKS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
        </div>
        <p className="copy">© 2026 Uni Boost · Giza, Egypt. All rights reserved. · <a href="/privacy">Privacy and cancellation</a></p>
      </div>
    </footer>
  );
}
