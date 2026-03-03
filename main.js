document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('text-input');
  const submitButton = document.getElementById('submit-button');
  const outputDiv = document.getElementById('output');

  submitButton.addEventListener('click', () => {
    const text = textInput.value;
    if (text) {
      const newParagraph = document.createElement('p');
      newParagraph.textContent = `You entered: ${text}`;
      outputDiv.appendChild(newParagraph);
      textInput.value = '';
    }
  });
});
