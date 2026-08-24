import { useState, type CSSProperties } from 'react'
import { authInitError, isAuthenticated, login, logout, modeBConfigured, subject } from './auth'

// ── Interactive auth-mode chooser ───────────────────────────────────────────
// One question decides everything: does your login system have an OIDC IdP
// that publishes JWKS? No → Mode A (you attest user identity). Yes → Mode B
// (the video service verifies it) — with a real Keycloak login to try live.

const box: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 12 }
const codeStyle: CSSProperties = {
  background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 8,
  fontSize: 13, overflowX: 'auto', whiteSpace: 'pre',
}

function Code({ children }: { children: string }) {
  return <pre style={codeStyle}><code>{children}</code></pre>
}

function ModeAPanel() {
  return (
    <section>
      <h3>🅰️ Mode A — คุณเป็นคนรับรอง user เอง</h3>
      <p>
        ทุก request ใช้แค่ publishable key (<code>pk_...</code>) + origin ของหน้าเว็บต้องอยู่ใน allowlist
        ส่วน "วิดีโอนี้เป็นของ user คนไหน" คุณส่งมาเองผ่าน <code>external_user_ref</code> —
        server <b>ไม่ verify</b> ค่านี้ ระบบของคุณเป็นคนรับรอง (attest) ว่าถูกต้อง
      </p>
      <Code>{`const config = {
  apiBaseUrl: 'https://api.packiko.com',
  publicKey: 'pk_...',
}
// ระบุ user ตอน mint: คุณรับรองเอง server เก็บตามที่ส่งมา
await queue.enqueue({ blob, orderRef, context: { userRef: 'user-1234' } })`}</Code>
      <div style={box}>
        <p>💡 <b>เคสตรงตัว:</b> ระบบ auth ภายในที่ออก token แบบ HS256 (symmetric) — server เรา verify
          ให้ไม่ได้เพราะต้องแชร์ signing secret ข้ามองค์กร → ใช้ Mode A</p>
        <p>⚠️ <b>ข้อจำกัดที่ต้องรู้:</b> ใครถือ <code>pk_</code> + ปลอม Origin header ได้ (นอก browser ทำได้เสมอ)
          ก็ mint upload ในนาม workspace คุณได้ — ค่าใช้จ่ายลงบัญชีคุณ ดังนั้น Mode A เหมาะกับงานความเสี่ยงต่ำ
          และ key rotate ได้เมื่อหลุด</p>
        <p>✅ demo ทั้งแอปนี้รัน Mode A อยู่แล้ว — ไปลองที่แท็บ 🎮 Playground ได้เลย</p>
      </div>
    </section>
  )
}

function ModeBLive() {
  if (!modeBConfigured) {
    return (
      <div style={{ ...box, background: '#f6f6f6' }}>
        <p>🔧 Mode B demo ยังไม่เปิดใช้ — รอ ThaiCloud provision key (หรือใส่ค่า IdP ของคุณเองผ่านตัวแปร
          <code> VITE_PACKIKO_MODE_B_*</code> ใน <code>.env</code> — ดู <code>.env.example</code>)</p>
      </div>
    )
  }
  if (authInitError) {
    return (
      <div style={{ ...box, background: '#fdf3f3' }}>
        <p>⚠️ ติดต่อ Keycloak ไม่ได้ — เช็ค <code>VITE_PACKIKO_KEYCLOAK_URL</code> / realm / client id ใน <code>.env</code></p>
      </div>
    )
  }
  if (!isAuthenticated()) {
    return (
      <div style={box}>
        <p>ลองของจริง: กดปุ่มแล้ว browser จะ redirect ไปหน้า login ของ Keycloak — login เสร็จเด้งกลับมาหน้านี้</p>
        <button onClick={login}>🔐 Login ผ่าน Keycloak</button>
      </div>
    )
  }
  return (
    <div style={{ ...box, background: '#e6f4ea' }}>
      <p>✅ login แล้วเป็น <code>sub: {subject()}</code></p>
      <p>ตั้งแต่ตอนนี้ <b>ทุก request</b> ในแท็บ Learn/Playground ใช้ pk ของ Mode B + แนบ <code>X-User-Token</code> อัตโนมัติ
        — ไปอัดวิดีโอดู แล้ววิดีโอนั้นจะถูกผูกกับ user นี้แบบ verify แล้ว
        (เปิด DevTools → Network ดู header ได้)</p>
      <button onClick={logout}>Logout (กลับ Mode A)</button>
    </div>
  )
}

function ModeBPanel() {
  return (
    <section>
      <h3>🅱️ Mode B — server verify user ให้ทุก request</h3>
      <p>flow มี 4 ขั้น และฝั่งโค้ดคุณเพิ่มแค่บรรทัดเดียว:</p>
      <ol>
        <li>user login กับ IdP ของคุณตามปกติ → ได้ JWT</li>
        <li>SDK แนบ JWT เป็น header <code>X-User-Token</code> ให้ <b>ทุก request</b> อัตโนมัติ</li>
        <li>server ดึง public key จาก JWKS ของ IdP คุณ แล้ว verify ลายเซ็น + issuer + วันหมดอายุ</li>
        <li>วิดีโอถูกผูกกับ <code>sub</code> ที่ verify แล้ว — ต่อให้ <code>pk_</code> หลุด คนอื่นก็ mint ไม่ได้เพราะไม่มี token จริง</li>
      </ol>
      <Code>{`const config = {
  apiBaseUrl: 'https://api.packiko.com',
  publicKey: 'pk_...',              // key ที่เปิด Mode B ไว้
  getUserToken: () => auth.getAccessToken(),  // ← เพิ่มบรรทัดเดียว
}`}</Code>
      <ModeBLive />
      <div style={box}>
        <p>🔒 <b>enforce-or-reject:</b> key ที่เปิด Mode B แล้ว token หาย/หมดอายุ/ปลอม = 401 เสมอ
          ไม่มีการหล่นกลับไป Mode A เงียบๆ</p>
        <p>⚙️ <b>ฝั่ง ThaiCloud ตั้งค่าให้แค่ 2 ค่า</b> (issuer + JWKS URL ของ IdP คุณ) — ไม่มี deploy ใหม่
          รองรับ IdP มาตรฐาน OIDC ทุกตัว เช่น Keycloak, Auth0, Entra ID</p>
      </div>
    </section>
  )
}

export default function AuthModes() {
  const [choice, setChoice] = useState<'a' | 'b' | null>(isAuthenticated() ? 'b' : null)
  return (
    <section>
      <h2>เลือกโหมด auth ยังไง</h2>
      <p>ทุก integration เริ่มที่ <code>pk_</code> เหมือนกันหมด — คำถามเดียวที่ตัดสินว่าควรเพิ่มชั้น User JWT ไหม:</p>
      <div style={{ ...box, borderColor: '#bbb' }}>
        <p style={{ fontSize: 17 }}>❓ ระบบ login ของคุณใช้ <b>IdP ที่เป็น OIDC และเผยแพร่ JWKS</b> หรือเปล่า?
          <br /><span style={{ color: '#888', fontSize: 14 }}>(เช่น Keycloak, Auth0, Microsoft Entra ID — มี URL <code>.well-known/openid-configuration</code>)</span></p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setChoice('b')} disabled={choice === 'b'}>✅ ใช่ — มี OIDC IdP</button>
          <button onClick={() => setChoice('a')} disabled={choice === 'a'}>❌ ไม่ / auth ทำเองในระบบ</button>
        </div>
      </div>
      {choice === 'a' && <ModeAPanel />}
      {choice === 'b' && <ModeBPanel />}
      {choice !== null && (
        <p style={{ marginTop: 16 }}>
          <button onClick={() => setChoice(choice === 'a' ? 'b' : 'a')}>↔ ดูอีกโหมดเทียบกัน</button>
        </p>
      )}
    </section>
  )
}
