// Page de revue des tests (npm run revue) : une fiche par test, l'avis de la QA enregistré à chaque changement.
(() => {
  const app = document.getElementById('revue');
  const { pertinences: PERTINENCES, causes: CAUSES } = JSON.parse(document.getElementById('choix').textContent);
  const STATUTS = {
    reussi: 'Réussi', echec: 'En échec', instable: 'Instable', interrompu: 'Interrompu', ignore: 'Non concerné', jamais: 'Jamais joué',
  };
  const PAGES = {
    '@home': 'Accueil', '@plp': 'Collection', '@pdp': 'Fiche produit', '@cart': 'Panier', '@checkout': 'Checkout',
    '@search': 'Recherche', '@account': 'Espace client', '@content': 'Pages éditoriales', '@sections': 'Pages de sections',
    '@journey': 'Parcours',
  };
  const APPAREILS = {
    'desktop-chrome': 'Chrome ordinateur', 'desktop-safari': 'Safari ordinateur', iphone: 'iPhone', android: 'Android', donnees: 'Données',
  };
  const ICONES = {
    reussi: '<path d="M3.5 8.5l3 3 6-7"/>', echec: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
    instable: '<path d="M8 3.5v5.5M8 12v.5"/>', interrompu: '<path d="M4.5 8h7"/>', ignore: '<path d="M4.5 8h7"/>', jamais: '<path d="M4.5 8h7"/>',
  };
  const esc = texte => String(texte ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const puce = statut => `<span class="puce puce--${statut}" aria-hidden="true"><svg viewBox="0 0 16 16" class="icone">${ICONES[statut] ?? ''}</svg></span>`;
  const ouTourne = projet => {
    const [env, appareil] = projet.split(' · ');
    return `${APPAREILS[appareil] ?? appareil} · ${env === 'prod' ? 'prod' : 'préprod'}`;
  };
  const dateCourte = iso => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ORDRE_ETAT = { echec: 0, instable: 1, jamais: 2, reussi: 3 };

  let tests = [];
  const filtres = { etat: 'tous', page: '', type: '', revus: true, texte: '' };
  try { Object.assign(filtres, JSON.parse(localStorage.getItem('revue-filtres') ?? '{}')); } catch { /* navigation privée */ }

  async function charger() {
    app.innerHTML = '<p class="aide">Chargement de la liste des tests et des derniers résultats…</p>';
    const reponse = await fetch('/revue/donnees.json');
    tests = (await reponse.json()).sort((a, b) => ORDRE_ETAT[a.etat] - ORDRE_ETAT[b.etat]
      || a.type.localeCompare(b.type, 'fr') || a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne);
    rendre();
  }

  function visibles() {
    const texte = filtres.texte.trim().toLowerCase();
    return tests.filter(t => (filtres.etat === 'tous' || t.etat === filtres.etat)
      && (!filtres.page || t.pages.includes(filtres.page))
      && (!filtres.type || t.type === filtres.type)
      && (filtres.revus || !t.avis?.pertinence)
      && (!texte || `${t.titre} ${t.description} ${t.fichier}`.toLowerCase().includes(texte)));
  }

  function bilan() {
    const revus = tests.filter(t => t.avis?.pertinence).length;
    const compte = (cle, valeur) => tests.filter(t => t.avis?.[cle] === valeur).length;
    const echecs = tests.filter(t => t.etat === 'echec');
    return `
      <div class="bilan">
        <div class="progression" role="progressbar" aria-valuemin="0" aria-valuemax="${tests.length}" aria-valuenow="${revus}" aria-label="Tests revus">
          <span style="width:${tests.length ? (revus / tests.length) * 100 : 0}%"></span>
        </div>
        <p><strong>${revus} / ${tests.length}</strong> tests revus · ${echecs.length} en échec, dont ${echecs.filter(t => t.avis?.cause).length} expliqués</p>
        <p class="capitales">${Object.entries(PERTINENCES).map(([cle, nom]) => `${esc(nom)} : ${compte('pertinence', cle)}`).join(' · ')}</p>
        <p class="capitales">${Object.entries(CAUSES).map(([cle, nom]) => `${esc(nom)} : ${compte('cause', cle)}`).join(' · ')}</p>
      </div>`;
  }

  function barreFiltres() {
    const types = [...new Set(tests.map(t => t.type))].sort((a, b) => a.localeCompare(b, 'fr'));
    const option = (valeur, nom, actuel) => `<option value="${esc(valeur)}"${valeur === actuel ? ' selected' : ''}>${esc(nom)}</option>`;
    return `
      <form class="filtres" aria-label="Filtres">
        <label>État<select name="etat">${option('tous', 'Tous', filtres.etat)}${option('echec', 'En échec', filtres.etat)}${option('instable', 'Instables', filtres.etat)}${option('jamais', 'Jamais joués', filtres.etat)}${option('reussi', 'Réussis', filtres.etat)}</select></label>
        <label>Page<select name="page">${option('', 'Toutes', filtres.page)}${Object.entries(PAGES).map(([e, nom]) => option(e, nom, filtres.page)).join('')}</select></label>
        <label>Type<select name="type">${option('', 'Tous', filtres.type)}${types.map(t => option(t, t, filtres.type)).join('')}</select></label>
        <label class="recherche">Recherche<input name="texte" type="search" value="${esc(filtres.texte)}" placeholder="nom, fichier…"></label>
        <label class="case"><input name="revus" type="checkbox"${filtres.revus ? ' checked' : ''}> Montrer les tests déjà revus</label>
      </form>`;
  }

  function fiche(t, index) {
    const id = `t${index}`;
    const avis = t.avis ?? {};
    const concernes = t.executions.filter(e => e.statut !== 'ignore');
    const nonConcernes = t.executions.length - concernes.length;
    const erreurs = [...new Set(concernes.filter(e => e.erreur).map(e => e.erreur))];
    const constats = [...new Set(t.executions.flatMap(e => e.constats ?? []))];
    const radio = (nom, valeurs, actuel) => Object.entries(valeurs).map(([cle, libelle]) => `
      <label class="choix"><input type="radio" name="${nom}-${id}" value="${cle}"${actuel === cle ? ' checked' : ''}><span>${esc(libelle)}</span></label>`).join('');
    return `
      <article class="fiche fiche--${t.etat}${avis.pertinence ? ' fiche--revue' : ''}" data-titre="${esc(t.titre)}" aria-labelledby="${id}">
        <header class="fiche__tete">
          <span class="etat">${puce(t.etat)}${esc(STATUTS[t.etat])}</span>
          <h2 id="${id}">${esc(t.titre)}</h2>
          <p class="capitales">${esc(t.type)}${t.pages.length ? ` · ${t.pages.map(p => esc(PAGES[p] ?? p)).join(', ')}` : ''} · ${esc(t.fichier)}:${t.ligne}</p>
        </header>
        <div class="fiche__corps">
          <section>
            <h3 class="capitales">Ce que vérifie le test</h3>
            ${t.description ? `<p>${esc(t.description)}</p>` : ''}
            ${t.etapes.length ? `<ol class="etapes">${t.etapes.map(e => `<li>${esc(e.replace(/^\d+[a-z]?\.\s*/, ''))}</li>`).join('')}</ol>` : '<p class="aide">Étapes non relevées.</p>'}
            ${constats.length ? `<ul class="constats">${constats.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
            ${t.contexte && t.contexte !== t.description ? `<details class="contexte"><summary>Contexte du fichier ${esc(t.fichier.replace(/^tests\//, ''))}</summary><p>${esc(t.contexte)}</p></details>` : ''}
          </section>
          <section>
            <h3 class="capitales">Derniers résultats</h3>
            <ul class="executions">${concernes.map(e => `
              <li>${e.lien ? `<a href="${esc(e.lien)}" target="_blank" rel="noopener">` : '<span>'}${puce(e.statut)}<span>${esc(ouTourne(e.projet))}</span><small>${esc(STATUTS[e.statut])}${e.date ? ` · ${esc(dateCourte(e.date))}` : ''}</small>${e.lien ? '</a>' : '</span>'}</li>`).join('')}
            </ul>
            ${nonConcernes ? `<p class="aide">Non concerné sur ${nonConcernes} autre${nonConcernes > 1 ? 's' : ''} appareil${nonConcernes > 1 ? 's' : ''} ou environnement${nonConcernes > 1 ? 's' : ''}.</p>` : ''}
            ${erreurs.map(e => `<p class="erreur">${esc(e)}</p>`).join('')}
            ${t.analyse ? `<div class="analyse"><h3 class="capitales">Première analyse</h3><p>${esc(t.analyse)}</p></div>` : ''}
          </section>
          <fieldset class="avis">
            <legend class="capitales">Ton avis</legend>
            <div class="groupe" role="radiogroup" aria-label="Ce test est-il utile ?"><p>Ce test est-il utile ?</p>${radio('pertinence', PERTINENCES, avis.pertinence)}</div>
            ${t.etat === 'echec' || t.etat === 'instable' || avis.cause ? `<div class="groupe" role="radiogroup" aria-label="Pourquoi échoue-t-il ?"><p>Pourquoi échoue-t-il ?</p>${radio('cause', CAUSES, avis.cause)}</div>` : ''}
            <label class="commentaire">Commentaire<textarea name="commentaire-${id}" rows="2" placeholder="Ce qu'il faudrait vérifier, le bug connu, la personne à qui demander…">${esc(avis.commentaire ?? '')}</textarea></label>
            <div class="pied"><p class="enregistre" aria-live="polite">${avis.date ? `Enregistré le ${esc(dateCourte(avis.date))}` : ''}</p>
            <button type="button" class="effacer">Effacer mon avis</button></div>
          </fieldset>
        </div>
      </article>`;
  }

  function rendre() {
    const liste = visibles();
    app.innerHTML = `${bilan()}${barreFiltres()}
      <p class="aide">${liste.length} test${liste.length > 1 ? 's' : ''} affiché${liste.length > 1 ? 's' : ''}, ceux en échec d'abord. Chaque choix est enregistré tout de suite dans <code>data/revue-tests.json</code>.</p>
      ${liste.map(t => fiche(t, tests.indexOf(t))).join('')}`;
  }

  async function enregistrer(article) {
    const titre = article.dataset.titre;
    const test = tests.find(t => t.titre === titre);
    const valeur = nom => article.querySelector(`[name^="${nom}-"]:checked`)?.value ?? '';
    const corps = {
      titre,
      pertinence: valeur('pertinence'),
      cause: valeur('cause'),
      commentaire: article.querySelector('textarea').value,
      etat: test.etat,
    };
    const message = article.querySelector('.enregistre');
    message.textContent = 'Enregistrement…';
    try {
      const reponse = await fetch('/revue/avis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      if (!reponse.ok) throw new Error(await reponse.text());
      test.avis = await reponse.json();
      message.textContent = test.avis ? `Enregistré le ${dateCourte(test.avis.date)}` : 'Avis effacé';
      article.classList.toggle('fiche--revue', Boolean(test.avis?.pertinence));
      app.querySelector('.bilan').outerHTML = bilan();
    } catch (erreur) {
      message.textContent = `Pas enregistré : ${erreur.message}. Le serveur (npm run revue) tourne-t-il encore ?`;
    }
  }

  app.addEventListener('click', evenement => {
    const bouton = evenement.target.closest('.effacer');
    if (!bouton) return;
    const article = bouton.closest('.fiche');
    article.querySelectorAll('input[type=radio]').forEach(r => { r.checked = false; });
    article.querySelector('textarea').value = '';
    enregistrer(article);
  });
  app.addEventListener('change', evenement => {
    const cible = evenement.target;
    if (cible.closest('.filtres')) {
      filtres[cible.name] = cible.type === 'checkbox' ? cible.checked : cible.value;
      try { localStorage.setItem('revue-filtres', JSON.stringify(filtres)); } catch { /* navigation privée */ }
      rendre();
      return;
    }
    const article = cible.closest('.fiche');
    if (article) enregistrer(article);
  });
  let attente;
  app.addEventListener('input', evenement => {
    const cible = evenement.target;
    if (cible.name === 'texte') {
      filtres.texte = cible.value;
      clearTimeout(attente);
      attente = setTimeout(() => {
        rendre();
        const champ = app.querySelector('[name="texte"]');
        champ.focus();
        champ.setSelectionRange(champ.value.length, champ.value.length);
      }, 300);
    } else if (cible.tagName === 'TEXTAREA') {
      clearTimeout(attente);
      attente = setTimeout(() => enregistrer(cible.closest('.fiche')), 800);
    }
  });

  charger();
})();
