import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getStorage, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAkBV0rHEghBOHl2mDOs6rMDHkUgYMxFr0",
    authDomain: "visaformulariostorage.firebaseapp.com",
    projectId: "visaformulariostorage",
    storageBucket: "visaformulariostorage.firebasestorage.app",
    messagingSenderId: "720170394408",
    appId: "1:720170394408:web:b1c294c39c489388f6261d"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const WHATSAPP_NUMBER = "556199998165";

const form = document.getElementById("ukEtaForm");
const submitBtn = document.getElementById("submitBtn");
const clearBtn = document.getElementById("clearBtn");
const statusBox = document.getElementById("statusBox");
const { jsPDF } = window.jspdf;

const clean = (value) => String(value || "").replace(/\r?\n+/g, " / ").replace(/[ \t]+/g, " ").trim();
const slug = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "cliente";
const formatDateBr = (value) => {
    const v = clean(value);
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || "Nao informado");
};

function setStatus(type, message) {
    statusBox.className = `status ${type}`;
    statusBox.textContent = message;
}

function clearStatus() {
    statusBox.className = "status";
    statusBox.textContent = "";
}

function toggleByValue(fieldId, targetId, showValue = "Sim") {
    const field = document.getElementById(fieldId);
    const target = document.getElementById(targetId);
    if (!field || !target) return;
    target.classList.toggle("hidden", field.value !== showValue);
}

function toggleSuitability() {
    const shouldShow = [...document.querySelectorAll(".suitability")].some((field) => field.value === "Sim");
    document.getElementById("suitabilityBox").classList.toggle("hidden", !shouldShow);
}

function validateForm() {
    clearStatus();

    for (const field of form.querySelectorAll("[data-required='1']")) {
        if (!clean(field.value)) {
            const label = form.querySelector(`label[for='${field.id}']`)?.textContent || "Campo obrigatorio";
            setStatus("error", `Preencha o campo obrigatorio: ${label}`);
            field.focus();
            return false;
        }
    }

    for (const field of form.querySelectorAll("[data-required-check='1']")) {
        if (!field.checked) {
            setStatus("error", "Confirme a declaracao para continuar.");
            field.focus();
            return false;
        }
    }

    if (document.getElementById("otherNamesUsed").value === "Sim") {
        if (!clean(document.getElementById("otherFamilyName").value) && !clean(document.getElementById("otherGivenNames").value)) {
            setStatus("error", "Preencha ao menos um outro nome ou sobrenome usado anteriormente.");
            document.getElementById("otherFamilyName").focus();
            return false;
        }
    }

    if (document.getElementById("hasUkContact").value === "Sim" && !clean(document.getElementById("ukAddress").value)) {
        setStatus("error", "Informe o endereco no Reino Unido ou marque que ainda nao possui.");
        document.getElementById("ukAddress").focus();
        return false;
    }

    if (document.getElementById("whoPays").value !== "Eu mesmo" && !clean(document.getElementById("payerName").value)) {
        setStatus("error", "Informe o nome do pagante.");
        document.getElementById("payerName").focus();
        return false;
    }

    if ([...document.querySelectorAll(".suitability")].some((field) => field.value === "Sim") && !clean(document.getElementById("suitabilityDetails").value)) {
        setStatus("error", "Explique as respostas de suitability marcadas como Sim.");
        document.getElementById("suitabilityDetails").focus();
        return false;
    }

    return true;
}

function raw() {
    return Object.fromEntries(new FormData(form).entries());
}

function line(label, value) {
    return `${label}: ${value || "Nao informado"}`;
}

function addSection(doc, state, title) {
    if (state.y > 268) {
        doc.addPage();
        state.y = 18;
    }
    doc.setFillColor(29, 59, 109);
    doc.rect(15, state.y - 4, 180, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, 18, state.y + 1.5);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    state.y += 11;
}

function addText(doc, state, text, bold = false, indent = 0) {
    doc.setFont("Helvetica", bold ? "bold" : "normal");
    doc.splitTextToSize(text || "Nao informado", 170 - indent).forEach((lineText) => {
        if (state.y > 275) {
            doc.addPage();
            state.y = 18;
        }
        doc.text(lineText, 20 + indent, state.y);
        state.y += 6;
    });
    state.y += 1;
}

function generatePdfBlob() {
    const data = raw();
    const fullName = `${clean(data.givenNames)} ${clean(data.familyName)}`.trim();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const state = { y: 18 };

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Formulario ETA Reino Unido", 20, state.y);
    state.y += 8;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Solicitante: ${fullName || "Nao informado"}`, 20, state.y);
    state.y += 10;

    addSection(doc, state, "Dados pessoais");
    [
        line("Nome(s)", clean(data.givenNames)),
        line("Sobrenome", clean(data.familyName)),
        line("Outros nomes usados", data.otherNamesUsed),
        line("Outro sobrenome", clean(data.otherFamilyName)),
        line("Outro nome", clean(data.otherGivenNames)),
        line("Sexo", clean(data.sex)),
        line("Data de nascimento", formatDateBr(data.dob)),
        line("Pais de nascimento", clean(data.birthCountry)),
        line("Cidade de nascimento", clean(data.birthCity)),
        line("Nacionalidade", clean(data.nationality))
    ].forEach((item, index) => addText(doc, state, item, index === 0));

    addSection(doc, state, "Passaporte");
    [
        line("Numero do passaporte", clean(data.passportNumber)),
        line("Pais emissor", clean(data.passportCountry)),
        line("Data de emissao", formatDateBr(data.passportIssueDate)),
        line("Data de validade", formatDateBr(data.passportExpiryDate)),
        line("Foto da pagina do passaporte disponivel", clean(data.passportImageReady)),
        line("Foto do rosto disponivel", clean(data.facePhotoReady))
    ].forEach((item) => addText(doc, state, item));

    addSection(doc, state, "Contato");
    [
        line("Endereco", clean(data.homeAddress)),
        line("Cidade", clean(data.homeCity)),
        line("Estado / provincia", clean(data.homeState)),
        line("CEP", clean(data.homePostalCode)),
        line("Pais", clean(data.homeCountry)),
        line("E-mail", clean(data.email)),
        line("Telefone", clean(data.phone))
    ].forEach((item) => addText(doc, state, item));

    addSection(doc, state, "Viagem ao Reino Unido");
    [
        line("Motivo principal", clean(data.travelPurpose)),
        line("Data estimada de chegada", formatDateBr(data.estimatedArrival)),
        line("Tempo estimado de permanencia", clean(data.estimatedStay)),
        line("Outro motivo", clean(data.travelPurposeOther)),
        line("Tem contato / hotel no Reino Unido", clean(data.hasUkContact)),
        line("Nome do contato / hotel", clean(data.ukContactName)),
        line("Telefone do contato", clean(data.ukContactPhone)),
        line("Endereco no Reino Unido", clean(data.ukAddress)),
        line("Quem paga a viagem", clean(data.whoPays)),
        line("Nome do pagante", clean(data.payerName)),
        line("Relacao com o solicitante", clean(data.payerRelationship)),
        line("Telefone do pagante", clean(data.payerPhone)),
        line("E-mail do pagante", clean(data.payerEmail))
    ].forEach((item) => addText(doc, state, item));

    addSection(doc, state, "Trabalho e estudo");
    [
        line("Ocupacao atual", clean(data.occupation)),
        line("Empresa / instituicao", clean(data.employer)),
        line("Cidade e pais", clean(data.workCityCountry)),
        line("Endereco da empresa / instituicao", clean(data.workAddress))
    ].forEach((item) => addText(doc, state, item));

    addSection(doc, state, "Suitability");
    [
        line("Visto ou entrada negada no Reino Unido", clean(data.refusedUk)),
        line("Remocao ou deportacao", clean(data.removedUk)),
        line("Condenacao criminal", clean(data.criminalConviction)),
        line("Terrorismo, extremismo ou crimes de guerra", clean(data.terrorLinks)),
        line("Detalhes", clean(data.suitabilityDetails))
    ].forEach((item) => addText(doc, state, item));

    addSection(doc, state, "Declaracao");
    [
        line("Declarante", clean(data.declarationName)),
        line("Local", clean(data.declarationCity)),
        line("Data", formatDateBr(data.declarationDate)),
        line("Aceite", data.declarationAccept ? "Sim" : "Nao")
    ].forEach((item, index) => addText(doc, state, item, index === 0));

    addText(doc, state, `Eu, ${clean(data.declarationName)}, declaro que as informacoes prestadas neste formulario sao verdadeiras, completas e corretas conforme o meu melhor conhecimento.`);
    addText(doc, state, "Reconheco que a ETA e decidida exclusivamente pelas autoridades competentes do Reino Unido.");
    addText(doc, state, "Autorizo a empresa responsavel pelo atendimento a usar estas informacoes para preparar minha solicitacao online de ETA.");

    return doc.output("blob");
}

async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;

    submitBtn.classList.add("saving");
    submitBtn.disabled = true;
    clearBtn.disabled = true;
    clearStatus();

    try {
        const data = raw();
        const fullName = `${clean(data.givenNames)} ${clean(data.familyName)}`.trim();
        const pdfBlob = generatePdfBlob();
        const timestamp = Date.now();
        const applicantSlug = `${slug(data.familyName)}_${slug(data.givenNames)}`;
        const storageRef = ref(storage, `pdfs/uk_eta_${applicantSlug}_${timestamp}.pdf`);

        await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
        const pdfUrl = await getDownloadURL(storageRef);

        const whatsappMessage = [
            "Novo formulario UK ETA.",
            fullName ? `Cliente: ${fullName}` : "",
            clean(data.passportNumber) ? `Passaporte: ${clean(data.passportNumber)}` : "",
            `PDF: ${pdfUrl}`
        ].filter(Boolean).join("\n");

        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`, "_blank", "noopener");
        setStatus("success", "Formulario enviado com sucesso. Seus dados foram registrados.");

        form.reset();
        document.getElementById("otherNamesUsed").value = "Nao";
        document.getElementById("hasUkContact").value = "Sim";
        document.getElementById("whoPays").value = "Eu mesmo";
        document.getElementById("passportImageReady").value = "Sim";
        document.getElementById("facePhotoReady").value = "Sim";
        document.querySelectorAll(".suitability").forEach((field) => { field.value = "Nao"; });
        syncDeclarationName();
        toggleByValue("otherNamesUsed", "otherNamesBox", "Sim");
        toggleByValue("hasUkContact", "ukContactBox", "Sim");
        document.getElementById("payerBox").classList.add("hidden");
        toggleSuitability();
    } catch (error) {
        console.error(error);
        setStatus("error", "Nao foi possivel concluir o envio neste momento. Tente novamente em instantes.");
    } finally {
        submitBtn.classList.remove("saving");
        submitBtn.disabled = false;
        clearBtn.disabled = false;
    }
}

function syncDeclarationName() {
    const declarationName = document.getElementById("declarationName");
    if (declarationName.dataset.locked === "1") return;
    declarationName.value = `${clean(document.getElementById("givenNames").value)} ${clean(document.getElementById("familyName").value)}`.trim();
}

clearBtn.addEventListener("click", () => {
    form.reset();
    clearStatus();
    document.getElementById("otherNamesUsed").value = "Nao";
    document.getElementById("hasUkContact").value = "Sim";
    document.getElementById("whoPays").value = "Eu mesmo";
    document.getElementById("passportImageReady").value = "Sim";
    document.getElementById("facePhotoReady").value = "Sim";
    document.querySelectorAll(".suitability").forEach((field) => { field.value = "Nao"; });
    document.getElementById("payerBox").classList.add("hidden");
    toggleByValue("otherNamesUsed", "otherNamesBox", "Sim");
    toggleByValue("hasUkContact", "ukContactBox", "Sim");
    toggleSuitability();
});

form.addEventListener("submit", handleSubmit);
document.getElementById("otherNamesUsed").addEventListener("change", () => toggleByValue("otherNamesUsed", "otherNamesBox", "Sim"));
document.getElementById("hasUkContact").addEventListener("change", () => toggleByValue("hasUkContact", "ukContactBox", "Sim"));
document.getElementById("whoPays").addEventListener("change", (event) => {
    document.getElementById("payerBox").classList.toggle("hidden", event.target.value === "Eu mesmo");
});
document.querySelectorAll(".suitability").forEach((field) => field.addEventListener("change", toggleSuitability));
document.getElementById("givenNames").addEventListener("input", syncDeclarationName);
document.getElementById("familyName").addEventListener("input", syncDeclarationName);
document.getElementById("declarationName").addEventListener("input", (event) => {
    event.target.dataset.locked = clean(event.target.value) ? "1" : "";
});

toggleByValue("otherNamesUsed", "otherNamesBox", "Sim");
toggleByValue("hasUkContact", "ukContactBox", "Sim");
document.getElementById("payerBox").classList.add("hidden");
toggleSuitability();
