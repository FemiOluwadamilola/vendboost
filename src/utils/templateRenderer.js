function renderTemplate(template, data = {}) {
  let output = template;

  for (const key in data) {
    const regex = new RegExp(`{${key}}`, "g");
    output = output.replace(regex, data[key] || "");
  }

  return output;
}

module.exports = renderTemplate;