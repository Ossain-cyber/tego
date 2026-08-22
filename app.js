const SUPABASE_URL = 'https://wepbechfempjhabhzbyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c';

function showError(message) {
  document.getElementById('loading').innerHTML = `
    <div style="text-align:center;padding:20px;">
      <div style="font-size:40px;margin-bottom:16px;">⚠️</div>
      <h3 style="margin-bottom:8px;">Error</h3>
      <p style="color:#EF4444;font-size:14px;">${message}</p>
    </div>
  `;
}

try {
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  supabase.auth.getSession().then(function(result) {
    if (result.error) {
      showError('Session error: ' + result.error.message);
      return;
    }
    
    if (result.data && result.data.session) {
      showError('Session found. User ID: ' + result.data.session.user.id);
    } else {
      showError('No session found. We should show the login screen.');
    }
  }).catch(function(err) {
    showError('Promise error: ' + err.message);
  });
} catch (err) {
  showError('Setup error: ' + err.message);
}
