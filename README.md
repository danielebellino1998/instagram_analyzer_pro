# Instagram Analyzer PRO v3.0

Analizzatore locale delle esportazioni Instagram per confrontare follower, following e relazioni reciproche.

🌐 **WEB App online:**  
https://danielebellino1998.github.io/instagram_analyzer_pro/

---

## ✨ Funzionalità

✅ Analisi follower/following  
✅ Supporto file multipli Instagram (`followers_1.json`, `following_1.json`, ecc.)  
✅ Individuazione account che segui ma non ti seguono  
✅ Individuazione follower che non segui  
✅ Ricerca utenti  
✅ Visualizzazione data di follow quando disponibile  
✅ Cache locale dell'ultima analisi  
✅ Ripristino automatico della sessione  
✅ Ripristino posizione di navigazione  
✅ Pulizia completa dei dati salvati  
✅ PWA Ready

---

## 🚀 Utilizzo

1. Scaricare il proprio archivio dati da Instagram
2. Caricare il file ZIP nell'app
3. Avviare l'analisi

---

## 🔒 Privacy

L'elaborazione dei dati avviene interamente nel browser.
Nessun dato Instagram viene inviato a server esterni.

---

## 🛠️ Tecnologie

- HTML5
- CSS3
- JavaScript
- JSZip
- Web Storage API
- PWA Manifest
- GitHub Pages

---

## 📌 Versione

**v3.0 - Aggiornamento Privacy e Esperienza Utente**

Principali aggiornamenti:
- Algoritmo: regex ancorate, confronto senza distinzione maiuscole/minuscole, lettura sia dei file con title sia con value, e followDates che si azzera a ogni analisi.
- Errori chiari: try/catch con messaggi in pagina per ZIP sbagliato, JSON rotto, export in HTML invece che JSON, file mancanti o ZIP troppo grande.
- Sicurezza: gli username vengono inseriti nella pagina senza innerHTML né onclick. Prima un ZIP manipolato poteva iniettare codice.
- Prestazioni: la ricerca ha un ritardo di 200 ms e non riscrive più la cache a ogni lettera. Il segno “visitato” si applica senza ridisegnare la lista, quindi lo scroll non salta.
- Interfaccia: statistiche con stile e griglia adattiva, contatore dei risultati, tab attiva evidenziata, pulsante per le richieste ricevute di recente, Pulisci tutto che cancella anche la cronologia dei visitati.
- Privacy: il testo ora dice che i dati restano nel browser finché non premi “Pulisci tutto”, e all’apertura compare la data dell’ultima analisi.
- PWA: manifest completo con icone, e sw.js che fa funzionare l’app offline (serve https, per esempio GitHub Pages).

---

## 👨‍💻 Autore

Daniele Bellino
