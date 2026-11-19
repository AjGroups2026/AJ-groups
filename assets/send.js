/* Sends a form to the AJ GROUPS inbox through FormSubmit. Usage: AJSend('Subject', { name: '...', email: '...' }).then(ok, fail) */
(function () {
  var URL = 'https://formsubmit.co/ajax/ajgroups.official2026@gmail.com';
  window.AJSend = function (subject, fields) {
    var body = { _subject: subject, _template: 'table', _captcha: 'false' };
    for (var k in fields) body[k] = fields[k];
    return fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.success === true || d.success === 'true') return true; throw new Error('send failed'); });
  };
})();
