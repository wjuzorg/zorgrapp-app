function updateVatText() {
  const vatStatus = document.getElementById("vat_status");
  const vatText = document.getElementById("vat_text");
  const vatCustomerWrap = document.getElementById("vatCustomerWrap");

  if (!vatStatus || !vatText || !vatCustomerWrap) {
    console.log("BTW velden niet gevonden");
    return;
  }

  vatCustomerWrap.style.display = "none";

  if (vatStatus.value === "vrijgesteld") {
    vatText.value =
      "BTW vrijgesteld van omzetbelasting volgens geldende vrijstelling.";
  } else {
    vatText.value = "";
  }

  if (vatStatus.value === "verlegd") {
    vatCustomerWrap.style.display = "block";
  }
}