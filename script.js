document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const qrId = params.get("qr_id");
  const sessionId = params.get("session_id");

  if (!qrId || !sessionId) {
    alert("❌ QR_ID o SESSION_ID no encontrado en la URL.");
    return;
  }

  const startBtn = document.getElementById("start-scan");
  startBtn.addEventListener("click", () => {
    startBtn.style.display = "none"; // Oculta el botón cuando se inicia
    iniciarEscaneoDirecto(qrId, sessionId);
    iniciarEscaneoTexto(qrId, sessionId);
  });
});

function iniciarEscaneoDirecto(qrId, sessionId) {
  const qrReader = document.getElementById("qr-reader");
  const codeReader = new ZXing.BrowserMultiFormatReader();
  let scanned = false;

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      qrReader.srcObject = stream;
      qrReader.play();

      codeReader.decodeFromVideoDevice(null, qrReader, (result, err) => {
        if (result && !scanned) {
          scanned = true;
          qrReader.classList.add("scan-success");

          try {
            const qrUrl = new URL(result.getText());
            const cdcid = qrUrl.searchParams.get("Id"); // Busca el CDC en el parámetro Id

            if (!cdcid || !qrId || !sessionId) {
              alert("⚠️ No se encontró un ID, qr_id o session_id válido.");
              return;
            }

            console.log("✅ CDC capturado: " + cdcid);

            fetch("https://api-qr-generator.onrender.com/qr/guardar-cdc", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                cdc_id: cdcid,
                qr_id: parseInt(qrId),
                session_id: sessionId,
              }),
            })
              .then((res) => {
                if (!res.ok) throw new Error("Error en la respuesta del servidor");
                return res.json();
              })
              .then((data) => {
                alert("✅ CDC guardado correctamente.");
              })
              .catch((err) => {
                alert("⚠️ Error al enviar el ID: " + err.message);
              });

            codeReader.reset();
            stream.getTracks().forEach((track) => track.stop());
          } catch (e) {
            alert("URL no válida: " + e.message);
          }
        }
      });
    })
    .catch((err) => {
      console.error("Error al acceder a la cámara:", err);
      alert("⚠️ Error al acceder a la cámara: " + err.message);
    });
}

function iniciarEscaneoTexto(qrId, sessionId) {
  const video = document.createElement("video");
  video.setAttribute("playsinline", "");
  video.style.display = "none";
  document.body.appendChild(video);

  let cdcEnviado = false;

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      video.srcObject = stream;
      video.play();

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      const interval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA && !cdcEnviado) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL("image/png");

          Tesseract.recognize(imageData, "spa", {
            logger: (m) => console.log(m),
          })
            .then(({ data: { text } }) => {
              const match = text.match(/CDC:\s*([\d\s]+)/i);
              if (match) {
                const cdcid = match[1].replace(/\s+/g, "");
                if (cdcEnviado) return;
                cdcEnviado = true;

                console.log("✅ CDC detectado por OCR: " + cdcid);

                fetch("https://api-qr-generator.onrender.com/qr/guardar-cdc", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    cdc_id: cdcid,
                    qr_id: parseInt(qrId),
                    session_id: sessionId,
                  }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    alert("✅ CDC guardado correctamente (OCR).");
                  })
                  .catch((err) => {
                    alert("⚠️ Error al enviar el CDC: " + err.message);
                  });

                clearInterval(interval);
                stream.getTracks().forEach((track) => track.stop());
                video.remove();
              }
            })
            .catch((err) => console.error("OCR error:", err));
        }
      }, 1000);
    })
    .catch((err) => {
      alert("⚠️ Error al acceder a la cámara para OCR: " + err.message);
    });
}
