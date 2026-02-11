document.getElementById('btnGoBack').addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
});
