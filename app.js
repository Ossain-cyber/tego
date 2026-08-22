const SUPABASE_URL = 'https://wepbechfempjhabhzbyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

function showAuthScreen() {
  document.getElementById('loading').style.display = 'none';
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#F8FAFC;">
      <div style="background:white;border-radius:16px;padding:32px;width:90%;max-width:400px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:72px;height:72px;background:#2563EB;color:white;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:bold;margin:0 auto 16px;">T</div>
          <h2 style="margin:0;">Tego</h2>
          <p style="color:#6B7280;">Simple. Fast. Private.</p>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;margin-bottom:6px;font-weight:500;">Email</label>
          <input type="email" id="login-email" placeholder="you@example.com" style="width:100%;padding:12px;border:1px solid #E5E7EB;border-radius:8px;font-size:16px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;margin-bottom:6px;font-weight:500;">Password</label>
          <input type="password" id="login-password" placeholder="Your password" style="width:100%;padding:12px;border:1px solid #E5E7EB;border-radius:8px;font-size:16px;box-sizing:border-box;">
        </div>
        <button id="login-btn" style="width:100%;padding:14px;background:#2563EB;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Login</button>
        <p id="error-msg" style="color:#EF4444;font-size:14px;display:none;margin-top:12px;"></p>
      </div>
    </div>
  `;
  
  document.getElementById('login-btn').addEventListener('click', handleLogin);
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorMsg = document.getElementById('error-msg');
  
  if (!email || !password) {
    errorMsg.textContent = 'Please enter email and password';
    errorMsg.style.display = 'block';
    return;
  }
  
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  
  const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
  
  if (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Login';
  } else {
    window.location.reload();
  }
}

supabase.auth.onAuthStateChange(function(event, session) {
  if (event === 'SIGNED_IN') {
    window.location.reload();
  }
});

supabase.auth.getSession().then(function(result) {
  if (result.data && result.data.session) {
    currentUser = result.data.session.user;
    document.getElementById('loading').innerHTML = '<p style="text-align:center;">Logged in as ' + currentUser.email + '</p>';
  } else {
    showAuthScreen();
  }
}).catch(function() {
  showAuthScreen();
});
