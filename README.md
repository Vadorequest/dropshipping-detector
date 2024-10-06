# Dropshipping Detector
Dropshipping detector based on Antidrop.fr API.

## 🇫🇷 Tutoriel vidéo

<a href="https://www.loom.com/share/3219f9d896ba4d24ad227513bd708b73" target="_blank">
    <img src="https://github.com/user-attachments/assets/e0ab62a3-c797-438e-acec-eb02e6f38d28" alt="image">
</a>

## Features:
- Userscript (install it using Tampermonkey, on any browser)

## Userscript

This userscript detects whether the current site is a dropshipping website using Antidrop.fr's API. It provides a warning based on the probability of dropshipping activities on the site you're visiting.

- Identify whether the current website is e-commerce
- If e-commerce detected, calls Antidrop.fr API
- If "Dropshipping probability" is higher than allowed threshold, shows a full screen warning, otherwise, shows a top banner warning (don't show anything if probability is 0)

### How to Install

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/).
2. Add [this userscript](./src/userscript.js) to your userscript manager.
3. Visit any e-commerce website and the script will automatically run.

## Status

Proof of concept, beta version.
False positives are possible.


## Disclaimer

This script is provided "as is", without any warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the script or the use or other dealings in the script.

**Use this script at your own risk.**

## License

This project is licensed under the [GNU GPL v3 License](./LICENSE).
