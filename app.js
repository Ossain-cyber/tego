document.getElementById('app').innerHTML = '<h1>app.js is running</h1>';

const SUPABASE_URL = 'https://wepbechfempjhabhzbyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcGJlY2hmZW1wamhhYmh6YnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc5NTksImV4cCI6MjEwMjgxMzk1OX0.msTHVjOeJBEdzr6vguP9fXiIHUxQbXHCG3X8M-hCl6c';

try {
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  document.getElementById('app').innerHTML += '<p>Supabase client created</p>';
  
  supabase.auth.getSession().then(function(result) {
    if (result.data && result.data.session) {
      document.getElementById('app').innerHTML += '<p>Session found</p>';
    } else {
      document.getElementById('app').innerHTML += '<p>No session</p>';
    }
  }).catch(function(err) {
    document.getElementById('app').innerHTML += '<p>Error: ' + err.message + '</p>';
  });
} catch (err) {
  document.getElementById('app').innerHTML += '<p>Setup error: ' + err.message + '</p>';
}
