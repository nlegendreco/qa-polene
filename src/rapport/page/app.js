/* Rapport Polène : page autonome (aucune dépendance), lit window.RAPPORT écrit par src/rapport/reporter.ts. */
(() => {
  'use strict';

  const R = window.RAPPORT;
  const app = document.getElementById('app');
  const infobulle = document.getElementById('infobulle');
  const visionneuse = document.getElementById('visionneuse');

  // ---------- Outils ----------

  const esc = valeur => String(valeur ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const nombre = n => Number(n).toLocaleString('fr-FR');

  function duree(ms) {
    if (!ms && ms !== 0) return '–';
    if (ms < 1000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
    const minutes = Math.floor(ms / 60_000);
    const secondes = Math.round((ms % 60_000) / 1000);
    return secondes ? `${minutes} min ${secondes} s` : `${minutes} min`;
  }

  const dateLongue = iso => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' ', ' ');
  const dateCourte = iso => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function taille(octets) {
    if (octets < 1024) return `${octets} o`;
    if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
    return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
  }

  const pluriel = (n, un, plusieurs) => `${nombre(n)} ${n > 1 ? plusieurs : un}`;

  const ICONES = {
    reussi: '<svg class="icone" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    echec: '<svg class="icone" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    instable: '<svg class="icone" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="12.5" r="1.2" fill="currentColor"/></svg>',
    ignore: '<svg class="icone" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    interrompu: '<svg class="icone" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="6" height="6" rx="1" fill="currentColor"/></svg>',
  };

  const STATUTS = {
    reussi: { libelle: 'Réussi', pluriel: 'Réussis', couleur: 'var(--ok)', ordre: 3 },
    instable: { libelle: 'Instable', pluriel: 'Instables', couleur: 'var(--instable)', ordre: 1 },
    echec: { libelle: 'Échec', pluriel: 'Échecs', couleur: 'var(--echec)', ordre: 0 },
    interrompu: { libelle: 'Interrompu', pluriel: 'Interrompus', couleur: 'var(--ignore)', ordre: 2 },
    ignore: { libelle: 'Ignoré', pluriel: 'Ignorés', couleur: 'var(--ignore)', ordre: 4 },
  };

  // Démos (régressions injectées, échec volontaire) : chaque test DOIT échouer, un échec y est une bonne nouvelle.
  const DEMO = R.tests.length > 0 && R.tests.every(t => t.etiquettes.some(e => e === '@regressions' || e === '@demo-echec'));
  // Une démo qui échoue pour une autre raison (limite Shopify, réseau, délai) n'a rien détecté : « non vérifié ».
  if (DEMO) {
    R.tests.forEach(t => {
      if (t.statut === 'echec' && !['Écart visuel', 'Vérification en échec'].includes(t.categorie)) t.statut = 'interrompu';
    });
  }
  const libelleStatut = s => (DEMO && s === 'echec' ? 'Détecté' : DEMO && s === 'reussi' ? 'Non détecté' : DEMO && s === 'interrompu' ? 'Non vérifié' : STATUTS[s].libelle);
  // En démo, l'apparence suit le sens : « Détecté » (échec voulu) en vert avec une coche, « Non détecté » en rouge.
  const aspect = s => (DEMO && s === 'echec' ? 'reussi' : DEMO && s === 'reussi' ? 'echec' : s);
  if (DEMO) {
    [STATUTS.echec.couleur, STATUTS.reussi.couleur] = [STATUTS.reussi.couleur, STATUTS.echec.couleur];
    [STATUTS.echec.ordre, STATUTS.reussi.ordre] = [STATUTS.reussi.ordre, STATUTS.echec.ordre];
    Object.assign(STATUTS.echec, { libelle: 'Détecté', pluriel: 'Détectés' });
    Object.assign(STATUTS.reussi, { libelle: 'Non détecté', pluriel: 'Non détectés' });
    Object.assign(STATUTS.interrompu, { libelle: 'Non vérifié', pluriel: 'Non vérifiés' });
  }
  const puceBrute = (s, libelle) => `<span class="puce puce--${s}" title="${esc(libelle)}">${ICONES[s]}<span class="masque-visuel">${esc(libelle)}</span></span>`;
  const puce = s => puceBrute(aspect(s), libelleStatut(s));
  const pastille = s => `<span class="pastille pastille--${aspect(s)}">${ICONES[aspect(s)]}${esc(libelleStatut(s))}</span>`;

  const parId = new Map(R.tests.map(t => [t.id, t]));
  const parCle = new Map(R.tests.map(t => [t.cle, t]));
  const historique = R.historique ?? [];
  const totaux = { reussi: 0, echec: 0, instable: 0, ignore: 0, interrompu: 0 };
  R.tests.forEach(t => { totaux[t.statut]++; });
  const nbTests = R.tests.length;

  /** Statuts d'un test sur les derniers lancements (du plus ancien au plus récent). */
  function parcoursDe(cle, combien = 12) {
    return historique.slice(-combien).map(l => ({ date: l.date, actuel: l.id === R.lancement.id, ...(l.tests[cle] ?? { s: null, d: null }) }));
  }

  function points(cle, combien = 12) {
    return `<span class="points" aria-label="Derniers lancements">${parcoursDe(cle, combien).map(p => `<span class="${p.s ? aspect(p.s) : ''} ${p.actuel ? 'actuel' : ''}" data-info="${esc(`${dateCourte(p.date)} · ${p.s ? libelleStatut(p.s) : 'pas lancé'}${p.d != null ? ` · ${duree(p.d)}` : ''}`)}"></span>`).join('')}</span>`;
  }

  // ---------- Infobulle ----------

  function montrerInfo(html, x, y) {
    infobulle.innerHTML = html;
    infobulle.hidden = false;
    const { width, height } = infobulle.getBoundingClientRect();
    const gauche = Math.min(window.innerWidth - width - 12, x + 14);
    const haut = y + height + 18 > window.innerHeight ? y - height - 12 : y + 16;
    infobulle.style.left = `${Math.max(8, gauche)}px`;
    infobulle.style.top = `${Math.max(8, haut)}px`;
  }
  const cacherInfo = () => { infobulle.hidden = true; };

  document.addEventListener('mouseover', e => {
    const cible = e.target.closest('[data-info]');
    if (cible) montrerInfo(esc(cible.dataset.info), e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e => {
    if (e.target.closest('[data-info]')) montrerInfo(esc(e.target.closest('[data-info]').dataset.info), e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', e => { if (e.target.closest('[data-info]')) cacherInfo(); });

  // ---------- Visionneuse d'images ----------

  function ouvrirImage(src, legende) {
    visionneuse.innerHTML = `<span class="legende-image">${esc(legende)}</span><button class="fermer" type="button">Fermer · Échap</button><img src="${esc(src)}" alt="${esc(legende)}">`;
    visionneuse.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function fermerImage() {
    visionneuse.hidden = true;
    visionneuse.innerHTML = '';
    document.body.style.overflow = '';
  }
  visionneuse.addEventListener('click', fermerImage);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !visionneuse.hidden) fermerImage(); });
  document.addEventListener('click', e => {
    const bouton = e.target.closest('[data-image]');
    if (bouton) ouvrirImage(bouton.dataset.image, bouton.dataset.legende ?? '');
  });

  // ---------- Navigation ----------

  function route() {
    const [chemin, requete = ''] = location.hash.replace(/^#/, '').split('?');
    return { chemin: chemin || '/', params: new URLSearchParams(requete) };
  }

  function entete(actif) {
    const echecs = totaux.echec + totaux.interrompu;
    return `
      <header class="entete"><div class="entete__ligne">
        <nav aria-label="Navigation">
          <a href="#/" class="capitales ${actif === 'tableau' ? 'actif' : ''}">Tableau de bord</a>
          <a href="#/tests" class="capitales ${actif === 'tests' ? 'actif' : ''}">Tests · ${nombre(nbTests)}${echecs && !DEMO ? ` · <span style="color:var(--echec-texte)">${nombre(echecs)} en échec</span>` : ''}</a>
        </nav>
        <a href="#/" class="logo" aria-label="Polène, tableau de bord"><svg aria-hidden="true"><use href="#logo-polene"/></svg></a>
        <div class="entete__infos"><strong>${esc(R.titre)}</strong><span class="discret">${esc(dateLongue(R.lancement.date))}</span></div>
      </div></header>`;
  }

  function rendre() {
    cacherInfo();
    const { chemin, params } = route();
    if (chemin.startsWith('/test/')) {
      const test = parId.get(decodeURIComponent(chemin.slice(6)));
      if (test) return afficher('tests', vueTest(test, params), () => brancherTest(test, params));
    }
    if (chemin === '/tests') return afficher('tests', vueTests(params), brancherTests);
    afficher('tableau', vueTableau(), brancherTableau);
  }

  function afficher(actif, contenu, brancher) {
    app.innerHTML = `${entete(actif)}<main>${contenu}${pied()}</main>`;
    brancher?.();
  }

  window.addEventListener('hashchange', () => { rendre(); window.scrollTo(0, 0); });

  const pied = () => `
    <footer class="pied">
      <span>Généré le ${esc(dateLongue(R.genereLe))}</span>
      <span>${esc(R.commande)}</span>
      <span>Playwright ${esc(R.playwright)} · ${pluriel(R.workers, 'navigateur', 'navigateurs')} en parallèle · ${R.reessais ? pluriel(R.reessais, 'second essai', 'essais supplémentaires') + ' en cas d\'échec' : 'aucun second essai'}</span>
      <a href="${esc(R.rapportPlaywright)}/index.html">Rapport Playwright détaillé</a>
      <span style="margin-left:auto">© Polène · QA automatisée</span>
    </footer>`;

  // ---------- Tableau de bord ----------

  function verdict() {
    const echecs = totaux.echec + totaux.interrompu;
    const executes = nbTests - totaux.ignore;
    let statut, titre, sous;
    if (!nbTests) {
      statut = 'ignore'; titre = 'Aucun test lancé'; sous = 'Vérifier la commande et les étiquettes.';
    } else if (DEMO) {
      const detectes = totaux.echec, manques = totaux.reussi + totaux.instable, nonVerifies = totaux.interrompu;
      sous = 'Démo : chaque test casse lui-même la page et doit échouer. Un échec est ici le résultat attendu.';
      if (manques) {
        statut = 'echec';
        titre = `${pluriel(manques, 'régression non détectée', 'régressions non détectées')}`;
      } else if (nonVerifies) {
        statut = 'instable';
        titre = `${nombre(detectes)} / ${nombre(executes)} détectées, ${pluriel(nonVerifies, 'non vérifiée', 'non vérifiées')}`;
        sous += ' « Non vérifié » : le test s\'est arrêté avant la comparaison (limite Shopify, réseau…), à relancer.';
      } else {
        statut = 'reussi';
        titre = `${nombre(detectes)} / ${nombre(executes)} régressions détectées`;
      }
    } else if (echecs) {
      statut = 'echec'; titre = `${pluriel(echecs, 'test en échec', 'tests en échec')}`;
      sous = `Sur ${pluriel(executes, 'test lancé', 'tests lancés')}. Les échecs sont en tête de liste.`;
    } else if (totaux.instable) {
      statut = 'instable'; titre = 'Tout est passé, avec des hésitations';
      sous = `${pluriel(totaux.instable, 'test a réussi', 'tests ont réussi')} seulement au second essai : à surveiller.`;
    } else {
      statut = 'reussi'; titre = 'Tout est conforme';
      sous = `${pluriel(executes, 'test réussi', 'tests réussis')} du premier coup.`;
    }
    const taux = executes ? Math.round(((DEMO ? totaux.echec : totaux.reussi + totaux.instable) / executes) * 100) : 0;
    const segments = ['reussi', 'instable', 'echec', 'interrompu', 'ignore'].filter(s => totaux[s]);
    return `
      <section class="verdict" aria-label="Résultat du lancement">
        <div>
          <p class="capitales second" style="margin:0 0 14px">${esc(R.titre)} · ${esc(R.environnements.join(', ') || '—')}</p>
          <div class="verdict__titre">${puceBrute(statut, titre)}<h1>${esc(titre)}</h1></div>
          <p class="second">${esc(sous)}</p>
          <p class="discret">${esc(dateLongue(R.lancement.date))} · durée ${esc(duree(R.lancement.duree))} · ${pluriel(R.appareils.length, 'appareil', 'appareils')} : ${esc(R.appareils.join(', '))}</p>
        </div>
        <div class="verdict__chiffre"><strong>${taux} %</strong><span class="capitales second">${DEMO ? 'de régressions détectées' : 'de tests réussis'}</span></div>
        <div class="verdict__barre">
          <div class="jauge" role="img" aria-label="${esc(segments.map(s => `${totaux[s]} ${STATUTS[s].pluriel.toLowerCase()}`).join(', '))}">
            ${segments.map(s => `<span style="flex:${totaux[s]};background:${STATUTS[s].couleur}" data-info="${esc(`${STATUTS[s].pluriel} : ${totaux[s]}`)}"></span>`).join('')}
          </div>
          <div class="legende">${segments.map(s => `<span><i style="background:${STATUTS[s].couleur}"></i>${esc(DEMO ? libelleStatut(s) : STATUTS[s].pluriel)} · ${nombre(totaux[s])}</span>`).join('')}</div>
        </div>
      </section>`;
  }

  function tuiles() {
    const commandes = R.tests.flatMap(t => t.annotations.filter(a => a.type === 'Commande de test'));
    const tuile = (statut, libelle, valeur, lien) => `
      <a class="tuile" href="${lien}" style="--tuile:${statut ? STATUTS[statut].couleur : 'var(--trait-fort)'}"><span class="tuile__titre capitales">${statut ? puce(statut) : ''}${esc(libelle)}</span><strong>${valeur}</strong></a>`;
    return `
      <section class="tuiles" aria-label="Chiffres clés">
        ${tuile('reussi', DEMO ? 'Non détectés' : 'Réussis', nombre(totaux.reussi), '#/tests?statut=reussi')}
        ${tuile('echec', DEMO ? 'Détectés' : 'Échecs', nombre(DEMO ? totaux.echec : totaux.echec + totaux.interrompu), '#/tests?statut=echec')}
        ${DEMO
          ? tuile('interrompu', 'Non vérifiés', nombre(totaux.interrompu), '#/tests?statut=interrompu')
          : tuile('instable', 'Instables', nombre(totaux.instable), '#/tests?statut=instable')}
        ${tuile('ignore', 'Ignorés', nombre(totaux.ignore), '#/tests?statut=ignore')}
        <div class="tuile" style="--tuile:var(--temps)"><span class="tuile__titre capitales">Durée totale</span><strong>${esc(duree(R.lancement.duree))}</strong></div>
        ${commandes.length ? `<div class="tuile" style="--tuile:var(--donnee-2)"><span class="tuile__titre capitales">Commandes créées</span><strong>${nombre(commandes.length)}</strong></div>` : ''}
      </section>`;
  }

  /** Tableau test × appareil : la vue « tout va bien ? » en un coup d'œil. */
  function matrice() {
    const appareils = R.appareils;
    const titres = [...new Set(R.tests.map(t => `${t.fichier}|${t.titre}`))];
    const lignes = titres.map(cle => {
      const [fichier, titre] = cle.split('|');
      const cellules = appareils.map(a => R.tests.find(t => t.titre === titre && t.fichier === fichier && t.appareil === a));
      const pire = Math.min(...cellules.filter(Boolean).map(t => STATUTS[t.statut].ordre));
      return { fichier, titre, cellules, pire };
    }).sort((a, b) => a.pire - b.pire || a.titre.localeCompare(b.titre, 'fr'));
    return `
      <section>
        <div class="titre-section"><h2>Par test et par appareil</h2><p class="discret">Cliquer sur une case pour voir le détail</p></div>
        <div class="matrice-cadre"><table class="matrice">
          <thead><tr><th scope="col">Test</th>${appareils.map(a => `<th scope="col" class="cellule">${esc(a)}</th>`).join('')}</tr></thead>
          <tbody>${lignes.map(l => `
            <tr>
              <th scope="row"><a href="#/test/${encodeURIComponent((l.cellules.find(Boolean)).id)}">${esc(l.titre)}</a><div class="mini">${esc(l.fichier)}</div></th>
              ${l.cellules.map(t => t ? `<td class="cellule"><a href="#/test/${encodeURIComponent(t.id)}" data-info="${esc(`${t.appareil} · ${libelleStatut(t.statut)} · ${duree(t.duree)}${t.essais.length > 1 ? ` · ${t.essais.length} essais` : ''}`)}">${puce(t.statut)}<small>${esc(duree(t.duree))}</small></a></td>` : '<td class="cellule discret">—</td>').join('')}
            </tr>`).join('')}
          </tbody>
        </table></div>
      </section>`;
  }

  // Graphique en colonnes empilées : statuts des derniers lancements.
  function graphiqueLancements(lancements) {
    const L = 560, H = 230, M = { haut: 12, droite: 8, bas: 30, gauche: 30 };
    const largeurUtile = L - M.gauche - M.droite, hauteurUtile = H - M.haut - M.bas;
    const max = Math.max(1, ...lancements.map(l => Object.values(l.totaux).reduce((a, b) => a + b, 0)));
    const pas = largeurUtile / lancements.length;
    const epaisseur = Math.min(24, pas * 0.62);
    const y = v => M.haut + hauteurUtile - (v / max) * hauteurUtile;
    const graduations = [...new Set([0, Math.round(max / 2), max])];
    const ordre = ['reussi', 'instable', 'echec', 'interrompu', 'ignore'];
    const colonnes = lancements.map((l, i) => {
      const x = M.gauche + i * pas + (pas - epaisseur) / 2;
      let base = 0;
      const presents = ordre.filter(s => l.totaux[s]);
      const segments = presents.map((s, j) => {
        const haut = y(base + l.totaux[s]), bas = y(base);
        base += l.totaux[s];
        const h = Math.max(1, bas - haut - (j < presents.length - 1 ? 0 : 0));
        const ecart = j > 0 ? 2 : 0;
        const hauteur = Math.max(1, h - ecart);
        if (j === presents.length - 1) {
          const r = Math.min(4, hauteur / 2, epaisseur / 2);
          return `<path d="M${x},${bas - ecart} V${haut + r} Q${x},${haut} ${x + r},${haut} H${x + epaisseur - r} Q${x + epaisseur},${haut} ${x + epaisseur},${haut + r} V${bas - ecart} Z" fill="${STATUTS[s].couleur}"/>`;
        }
        return `<rect x="${x}" y="${haut}" width="${epaisseur}" height="${hauteur}" fill="${STATUTS[s].couleur}"/>`;
      }).join('');
      const actuel = l.id === R.lancement.id;
      const info = `${dateCourte(l.date)}${actuel ? ' (ce lancement)' : ''} — ${presents.map(s => `${STATUTS[s].pluriel} : ${l.totaux[s]}`).join(', ')} — ${duree(l.duree)}`;
      return `<g>${segments}<rect x="${M.gauche + i * pas}" y="${M.haut}" width="${pas}" height="${hauteurUtile}" fill="transparent" data-info="${esc(info)}"/>${actuel ? `<text x="${x + epaisseur / 2}" y="${H - 4}" text-anchor="middle" class="axe-texte">ce lancement</text>` : ''}</g>`;
    }).join('');
    const etiquettes = lancements.map((l, i) => (i === 0 || (i === Math.floor(lancements.length / 2) && lancements.length > 6)) && l.id !== R.lancement.id
      ? `<text x="${M.gauche + i * pas + pas / 2}" y="${H - 10}" text-anchor="middle">${esc(dateCourte(l.date))}</text>` : '').join('');
    return `
      <div class="graphique">
        <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Statuts des ${lancements.length} derniers lancements">
          <g class="grille">${graduations.map(g => `<line x1="${M.gauche}" x2="${L - M.droite}" y1="${y(g)}" y2="${y(g)}"/>`).join('')}</g>
          <g class="axe">${graduations.map(g => `<text x="${M.gauche - 8}" y="${y(g) + 4}" text-anchor="end">${g}</text>`).join('')}${etiquettes}</g>
          ${colonnes}
        </svg>
      </div>`;
  }

  // Courbe des durées de lancement.
  function graphiqueDurees(lancements) {
    const L = 560, H = 230, M = { haut: 16, droite: 14, bas: 30, gauche: 46 };
    const largeurUtile = L - M.gauche - M.droite, hauteurUtile = H - M.haut - M.bas;
    const enMinutes = lancements.map(l => l.duree / 60_000);
    const max = Math.max(1, Math.ceil(Math.max(...enMinutes)));
    const x = i => M.gauche + (lancements.length === 1 ? largeurUtile / 2 : (i / (lancements.length - 1)) * largeurUtile);
    const y = v => M.haut + hauteurUtile - (v / max) * hauteurUtile;
    const graduations = [...new Set([0, Math.round(max / 2), max])];
    const trace = enMinutes.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const pas = lancements.length > 1 ? largeurUtile / (lancements.length - 1) : largeurUtile;
    return `
      <div class="graphique" data-durees>
        <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Durée des ${lancements.length} derniers lancements">
          <g class="grille">${graduations.map(g => `<line x1="${M.gauche}" x2="${L - M.droite}" y1="${y(g)}" y2="${y(g)}"/>`).join('')}</g>
          <g class="axe">${graduations.map(g => `<text x="${M.gauche - 8}" y="${y(g) + 4}" text-anchor="end">${g} min</text>`).join('')}
            <text x="${x(0)}" y="${H - 10}" text-anchor="start">${esc(dateCourte(lancements[0].date))}</text>
            <text x="${x(lancements.length - 1)}" y="${H - 10}" text-anchor="end">${esc(dateCourte(lancements.at(-1).date))}</text></g>
          <line class="curseur" x1="0" x2="0" y1="${M.haut}" y2="${M.haut + hauteurUtile}" visibility="hidden"/>
          <path d="${trace} L${x(lancements.length - 1)},${y(0)} L${x(0)},${y(0)} Z" fill="var(--temps)" opacity="0.12"/>
          <path d="${trace}" fill="none" stroke="var(--temps)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          ${enMinutes.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="var(--temps)" stroke="var(--fond)" stroke-width="2"/>`).join('')}
          ${lancements.map((l, i) => `<rect x="${Math.max(M.gauche, x(i) - pas / 2)}" y="${M.haut}" width="${Math.min(L - M.droite, x(i) + pas / 2) - Math.max(M.gauche, x(i) - pas / 2)}" height="${hauteurUtile}" fill="transparent" data-index="${i}" data-info="${esc(`${dateCourte(l.date)}${l.id === R.lancement.id ? ' (ce lancement)' : ''} — ${duree(l.duree)}`)}"/>`).join('')}
        </svg>
      </div>`;
  }

  function tableauChiffres(lancements) {
    return `
      <details class="chiffres-detail"><summary>Voir les chiffres</summary>
        <div class="defilement"><table><thead><tr><th>Lancement</th><th>Réussis</th><th>Instables</th><th>Échecs</th><th>Ignorés</th><th>Durée</th></tr></thead>
        <tbody>${lancements.slice().reverse().map(l => `<tr><td>${esc(dateCourte(l.date))}</td><td>${l.totaux.reussi}</td><td>${l.totaux.instable}</td><td>${l.totaux.echec + (l.totaux.interrompu ?? 0)}</td><td>${l.totaux.ignore}</td><td>${esc(duree(l.duree))}</td></tr>`).join('')}</tbody></table></div>
      </details>`;
  }

  function sectionHistorique() {
    const lancements = historique.slice(-20);
    if (lancements.length < 2) {
      return `<section><h2 style="margin-bottom:16px">Derniers lancements</h2><div class="vide">L'historique se construit à chaque lancement : les graphiques apparaîtront dès le deuxième.</div></section>`;
    }
    const presents = ['reussi', 'instable', 'echec', 'ignore'].filter(s => lancements.some(l => l.totaux[s]));
    return `
      <section class="grille-2">
        <div class="carte">
          <h3>Résultats des derniers lancements</h3>
          <p class="discret">${pluriel(lancements.length, 'lancement', 'lancements')} de « ${esc(R.titre)} »</p>
          <div class="legende" style="margin:0 0 10px">${presents.map(s => `<span><i style="background:${STATUTS[s].couleur}"></i>${esc(STATUTS[s].pluriel)}</span>`).join('')}</div>
          ${graphiqueLancements(lancements)}
          ${tableauChiffres(lancements)}
        </div>
        <div class="carte">
          <h3>Durée des lancements</h3>
          <p class="discret">Une hausse soudaine signale souvent un site lent ou une machine chargée</p>
          <div class="legende" style="margin:0 0 10px"><span><i class="trait" style="background:var(--temps)"></i>Durée totale</span></div>
          ${graphiqueDurees(lancements)}
        </div>
      </section>`;
  }

  function barres(elements) {
    const max = Math.max(...elements.map(e => e.valeur), 1);
    return `<div class="barres">${elements.map(e => `
      <${e.lien ? `a href="${e.lien}"` : 'div'} class="barre" ${e.info ? `data-info="${esc(e.info)}"` : ''}>
        <div class="barre__libelle"><span>${esc(e.libelle)}</span><span class="second chiffres">${esc(e.texte)}</span></div>
        <div class="barre__piste"><i style="width:${(e.valeur / max) * 100}%${e.couleur ? `;--barre:${e.couleur}` : ''}"></i>${e.repere != null ? `<b style="left:${Math.min(100, (e.repere / max) * 100)}%"></b>` : ''}</div>
      </${e.lien ? 'a' : 'div'}>`).join('')}</div>`;
  }

  function sectionAnalyse() {
    // Raisons des échecs (hors démos, où l'échec est voulu).
    const enEchec = R.tests.filter(t => t.categorie && (!DEMO || t.statut === 'instable'));
    const categories = Object.entries(enEchec.reduce((acc, t) => ({ ...acc, [t.categorie]: (acc[t.categorie] ?? 0) + 1 }), {}))
      .sort((a, b) => b[1] - a[1]);
    const raisons = categories.length
      ? barres(categories.map(([libelle, n], i) => ({ libelle, valeur: n, texte: pluriel(n, 'test', 'tests'), couleur: `var(--donnee-${(i % 3) + 1})`, lien: `#/tests?categorie=${encodeURIComponent(libelle)}` })))
      : `<div class="vide">${DEMO ? 'Démo : les échecs sont voulus.' : 'Aucun échec ni hésitation sur ce lancement.'}</div>`;

    // Tests à surveiller : échecs ou hésitations sur les 10 derniers lancements.
    const recents = historique.slice(-10);
    const surveiller = DEMO ? [] : [...new Set(recents.flatMap(l => Object.keys(l.tests)))]
      .map(cle => ({ cle, problemes: recents.filter(l => ['echec', 'instable', 'interrompu'].includes(l.tests[cle]?.s)).length, lances: recents.filter(l => l.tests[cle]).length }))
      .filter(e => e.problemes > 0)
      .sort((a, b) => b.problemes - a.problemes)
      .slice(0, 6);
    const aSurveiller = surveiller.length
      ? `<div class="barres">${surveiller.map(e => {
        const test = parCle.get(e.cle);
        const [projet, ...titre] = e.cle.split(' › ');
        const libelle = test ? `${test.titre} · ${test.appareil}` : `${titre.join(' › ')} · ${projet}`;
        return `<${test ? `a href="#/test/${encodeURIComponent(test.id)}"` : 'div'} class="barre"><div class="barre__libelle"><span>${esc(libelle)}</span><span class="second">${e.problemes} sur ${e.lances}</span></div>${points(e.cle, 10)}</${test ? 'a' : 'div'}>`;
      }).join('')}</div>`
      : `<div class="vide">${DEMO ? 'Sans objet pour une démo.' : recents.length < 2 ? 'Il faut au moins deux lancements pour repérer les tests fragiles.' : 'Aucun test n\'a échoué ou hésité sur les derniers lancements.'}</div>`;

    return `
      <section class="grille-2">
        <div class="carte"><h3>Pourquoi ça échoue</h3><p class="discret">Échecs et hésitations de ce lancement, par raison</p>${raisons}</div>
        <div class="carte"><h3>À surveiller</h3><p class="discret">Tests en échec ou instables sur les 10 derniers lancements</p>${aSurveiller}</div>
      </section>`;
  }

  function sectionLenteurs() {
    const lances = R.tests.filter(t => t.statut !== 'ignore');
    if (!lances.length) return '';
    const plusLents = lances.slice().sort((a, b) => b.duree - a.duree).slice(0, 6);
    const habituelle = cle => {
      const durees = historique.slice(-11, -1).map(l => l.tests[cle]?.d).filter(d => d != null).sort((a, b) => a - b);
      return durees.length >= 2 ? durees[Math.floor(durees.length / 2)] : null;
    };
    const reperes = new Map(plusLents.map(t => [t.cle, habituelle(t.cle)]));
    const avecRepere = [...reperes.values()].some(h => h != null);
    return `
      <section class="carte">
        <h3>Les plus longs</h3>
        <p class="discret">Durée de ce lancement, comparée à la durée habituelle (médiane des 10 lancements précédents)</p>
        <div class="legende" style="margin:0 0 14px"><span><i class="trait" style="background:var(--temps)"></i>Ce lancement</span>${avecRepere ? '<span><i class="trait" style="width:2px;height:12px;background:var(--encre)"></i>Durée habituelle</span>' : ''}</div>
        ${barres(plusLents.map(t => {
          const h = reperes.get(t.cle);
          const ecart = h ? Math.round(((t.duree - h) / h) * 100) : null;
          return {
            libelle: `${t.titre} · ${t.appareil}`,
            valeur: t.duree,
            repere: h,
            texte: `${duree(t.duree)}${ecart != null && Math.abs(ecart) >= 20 ? ` · ${ecart > 0 ? '+' : ''}${ecart} % par rapport à d'habitude` : ''}`,
            lien: `#/test/${encodeURIComponent(t.id)}`,
          };
        }))}
      </section>`;
  }

  function sectionCommandes() {
    const commandes = R.tests.flatMap(t => t.annotations.filter(a => a.type === 'Commande de test').map(a => ({ test: t, description: a.description })));
    if (!commandes.length) return '';
    return `
      <section class="carte">
        <h3>Commandes de test créées</h3>
        <p class="discret">À retrouver dans l'admin de la préprod</p>
        <dl class="informations">${commandes.map(c => `<dt>${esc(c.test.appareil)}</dt><dd><a href="#/test/${encodeURIComponent(c.test.id)}">${esc(c.description)}</a></dd>`).join('')}</dl>
      </section>`;
  }

  const vueTableau = () => [verdict(), tuiles(), matrice(), sectionHistorique(), sectionAnalyse(), sectionLenteurs(), sectionCommandes()].join('');

  function brancherTableau() {
    // Curseur vertical sur la courbe des durées.
    document.querySelectorAll('[data-durees] svg').forEach(svg => {
      const curseur = svg.querySelector('.curseur');
      const points = [...svg.querySelectorAll('circle')];
      svg.addEventListener('mousemove', e => {
        const zone = e.target.closest('[data-index]');
        if (!zone) return;
        const cx = points[Number(zone.dataset.index)].getAttribute('cx');
        curseur.setAttribute('x1', cx);
        curseur.setAttribute('x2', cx);
        curseur.setAttribute('visibility', 'visible');
        points.forEach((p, i) => p.setAttribute('r', i === Number(zone.dataset.index) ? '6' : '4'));
      });
      svg.addEventListener('mouseleave', () => {
        curseur.setAttribute('visibility', 'hidden');
        points.forEach(p => p.setAttribute('r', '4'));
      });
    });
  }

  // ---------- Liste des tests ----------

  function vueTests(params) {
    const statut = params.get('statut') ?? 'tous';
    const appareil = params.get('appareil') ?? 'tous';
    const categorie = params.get('categorie');
    const q = (params.get('q') ?? '').toLowerCase();
    const correspond = (t, avecStatut = true) =>
      (!avecStatut || statut === 'tous' || t.statut === statut || (!DEMO && statut === 'echec' && t.statut === 'interrompu'))
      && (appareil === 'tous' || t.appareil === appareil)
      && (!categorie || t.categorie === categorie)
      && (!q || `${t.titre} ${t.fichier} ${t.appareil} ${t.etiquettes.join(' ')} ${t.annotations.map(a => a.description).join(' ')}`.toLowerCase().includes(q));
    const tests = R.tests.filter(t => correspond(t))
      .sort((a, b) => STATUTS[a.statut].ordre - STATUTS[b.statut].ordre || a.titre.localeCompare(b.titre, 'fr') || a.appareil.localeCompare(b.appareil, 'fr'));
    const lien = changements => {
      const p = new URLSearchParams(params);
      Object.entries(changements).forEach(([k, v]) => (v == null || v === 'tous' ? p.delete(k) : p.set(k, v)));
      const texte = p.toString();
      return `#/tests${texte ? `?${texte}` : ''}`;
    };
    const compte = s => R.tests.filter(t => correspond({ ...t }, false) && (s === 'tous' || t.statut === s || (!DEMO && s === 'echec' && t.statut === 'interrompu'))).length;
    const filtresStatut = ['tous', 'echec', 'instable', ...(DEMO ? ['interrompu'] : []), 'reussi', 'ignore'].filter(s => s === 'tous' || s === statut || compte(s));

    return `
      <div class="titre-section"><h1>Tests</h1><p class="discret">${pluriel(tests.length, 'test affiché', 'tests affichés')} sur ${nombre(nbTests)}</p></div>
      <div class="filtres">
        <div class="groupe-filtres" role="group" aria-label="Statut">
          ${filtresStatut.map(s => `<a class="filtre ${statut === s ? 'actif' : ''}" href="${lien({ statut: s })}">${s === 'tous' ? 'Tous' : `${ICONES[aspect(s)]}${esc(DEMO ? libelleStatut(s) : STATUTS[s].pluriel)}`}<span class="nombre">${compte(s)}</span></a>`).join('')}
        </div>
        <div class="groupe-filtres" role="group" aria-label="Appareil">
          ${['tous', ...R.appareils].map(a => `<a class="filtre ${appareil === a ? 'actif' : ''}" href="${lien({ appareil: a })}">${a === 'tous' ? 'Tous les appareils' : esc(a)}</a>`).join('')}
        </div>
        <input class="recherche" type="search" placeholder="Chercher un test, un produit…" value="${esc(params.get('q') ?? '')}" aria-label="Chercher un test">
        ${categorie ? `<a class="filtre actif" href="${lien({ categorie: null })}">${esc(categorie)} ✕</a>` : ''}
      </div>
      ${tests.length ? `<div class="liste">${tests.map(ligneTest).join('')}</div>` : '<div class="vide">Aucun test ne correspond à ces filtres.</div>'}`;
  }

  function ligneTest(t) {
    const dernier = t.essais.at(-1);
    const motif = t.statut === 'echec' || t.statut === 'instable'
      ? (t.essais.find(e => e.erreurs.length && (t.statut === 'echec' ? e === dernier : true))?.erreurs[0]?.resume ?? t.categorie ?? '') : '';
    return `
      <a class="ligne-test" href="#/test/${encodeURIComponent(t.id)}">
        ${puce(t.statut)}
        <div>
          <div class="ligne-test__titre">${esc(t.titre)}</div>
          <div class="ligne-test__infos">
            <span>${esc(t.appareil)}</span>${t.env ? `<span>${esc(t.env === 'prod' ? 'Prod' : t.env === 'preprod' ? 'Préprod' : t.env)}</span>` : ''}<span class="discret">${esc(t.fichier)}</span>
            ${t.categorie && !DEMO ? `<span class="motif ${t.statut === 'instable' ? 'motif--instable' : ''}">${esc(t.categorie)}</span>` : ''}
          </div>
          ${motif ? `<div class="ligne-test__infos"><span class="${t.statut === 'instable' ? 'motif motif--instable' : 'motif'}">${esc(motif)}</span></div>` : ''}
        </div>
        <div class="ligne-test__droite">
          ${t.essais.length > 1 ? `<span>${t.essais.length} essais</span>` : ''}
          ${historique.length > 1 ? points(t.cle, 8) : ''}
          <span class="chiffres">${esc(duree(t.duree))}</span>
        </div>
      </a>`;
  }

  function brancherTests() {
    const champ = document.querySelector('.recherche');
    if (!champ) return;
    let minuterie;
    champ.addEventListener('input', () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(() => {
        const { params } = route();
        if (champ.value) params.set('q', champ.value); else params.delete('q');
        const texte = params.toString();
        history.replaceState(null, '', `#/tests${texte ? `?${texte}` : ''}`);
        app.querySelector('main').innerHTML = vueTests(params) + pied();
        brancherTests();
        const nouveau = document.querySelector('.recherche');
        nouveau.focus();
        nouveau.setSelectionRange(nouveau.value.length, nouveau.value.length);
      }, 200);
    });
  }

  // ---------- Fiche d'un test ----------

  const urlPiece = piece => piece?.chemin ? piece.chemin : null;
  // Image d'attente de la vidéo : la capture de fin de test (la première image de la vidéo est souvent blanche).
  const affiche = essai => {
    const images = essai.pieces.filter(p => p.type?.startsWith('image/') && p.chemin);
    return urlPiece(images.find(p => p.nom === 'screenshot') ?? images.at(-1));
  };
  const peutOuvrirTrace = location.protocol.startsWith('http');

  function vueTest(t, params) {
    const numero = Number(params.get('essai') ?? t.essais.length);
    const essai = t.essais.find(e => e.numero === numero) ?? t.essais.at(-1);
    const memeTest = R.tests.filter(x => x.titre === t.titre && x.fichier === t.fichier);
    const trace = essai?.pieces.find(p => p.nom === 'trace');
    const lienTrace = trace?.chemin && peutOuvrirTrace ? `trace/index.html?trace=${encodeURIComponent(new URL(trace.chemin, location.href).href)}` : null;
    const lienPlaywright = `${R.rapportPlaywright}/index.html#?testId=${encodeURIComponent(t.id)}`;

    return `
      <nav class="fil" aria-label="Fil d'Ariane"><a href="#/">Tableau de bord</a><span>›</span><a href="#/tests">Tests</a><span>›</span><span>${esc(t.titre)}</span></nav>
      <div class="fiche-entete">
        <div>
          <h1>${esc(t.titre)}</h1>
          <div class="meta">
            ${pastille(t.statut)}
            <span class="etiquette">${esc(t.appareil)}</span>
            ${t.env ? `<span class="etiquette">${esc(R.environnements.length === 1 ? R.environnements[0] : t.env)}</span>` : ''}
            <span class="etiquette chiffres">${esc(duree(t.duree))}</span>
            ${t.etiquettes.map(e => `<span class="etiquette">${esc(e)}</span>`).join('')}
            <span class="mini" style="margin:0">${esc(t.fichier)}:${t.ligne}</span>
          </div>
          ${memeTest.length > 1 ? `<div class="autres-appareils" aria-label="Même test sur les autres appareils">${memeTest.map(x => `<a href="#/test/${encodeURIComponent(x.id)}" class="${x.id === t.id ? 'actif' : ''}">${puce(x.statut)}${esc(x.appareil)}</a>`).join('')}</div>` : ''}
        </div>
        <div class="actions">
          ${trace ? (lienTrace
            ? `<a class="bouton bouton--plein" href="${esc(lienTrace)}" target="_blank" rel="noopener">Ouvrir la trace</a>`
            : `<a class="bouton" href="${esc(trace.chemin)}" download data-info="Pour l'ouvrir ici, lancer : npm run rapport:polene">Télécharger la trace</a>`) : ''}
          <a class="bouton" href="${esc(lienPlaywright)}" target="_blank" rel="noopener">Rapport Playwright</a>
        </div>
      </div>
      ${historique.length > 1 ? `<p class="capitales" style="display:flex;align-items:center;gap:12px;margin:18px 0 36px">Derniers lancements ${points(t.cle, 20)}</p>` : ''}
      ${t.annotations.length ? `<section><h2 style="margin-bottom:14px">Informations</h2><dl class="informations">${t.annotations.map(a => `<dt>${esc(a.type)}</dt><dd>${esc(a.description)}</dd>`).join('')}</dl></section>` : ''}
      ${t.essais.length > 1 ? `
        <section>
          <div class="onglets" role="tablist" aria-label="Essais">${t.essais.map(e => `<button type="button" role="tab" aria-selected="${e === essai}" data-essai="${e.numero}">${puce(statutEssai(e))}Essai ${e.numero} · ${esc(libelleEssai(e))}</button>`).join('')}</div>
          ${t.statut === 'instable' ? '<p class="second" style="margin:-8px 0 0">Ce test a échoué puis réussi au second essai : souvent un chargement lent ou un affichage capricieux, rarement un vrai bug. À surveiller s\'il se répète.</p>' : ''}
        </section>` : ''}
      ${essai ? vueEssai(t, essai) : '<div class="vide">Ce test n\'a pas été lancé.</div>'}`;
  }

  const statutEssai = e => (e.statut === 'passed' ? 'reussi' : e.statut === 'skipped' ? 'ignore' : e.statut === 'interrupted' ? 'interrompu' : 'echec');
  const libelleEssai = e => ({ passed: 'réussi', failed: 'échec', timedOut: 'délai dépassé', skipped: 'ignoré', interrupted: 'interrompu' })[e.statut];

  function vueEssai(t, essai) {
    const montrees = new Set();
    const comparaisons = essai.comparaisons.filter(c => c.obtenu != null || c.difference != null);
    comparaisons.forEach(c => [c.attendu, c.obtenu, c.difference].forEach(i => i != null && montrees.add(i)));
    if (essai.video >= 0) montrees.add(essai.video);
    essai.pieces.forEach((p, i) => { if (p.nom === 'trace') montrees.add(i); });

    const etapes = essai.etapes.filter(e => e.categorie === 'test.step' || e.erreur);
    etapes.forEach(e => e.pieces.forEach(i => montrees.add(i)));
    const autres = essai.pieces.map((p, i) => ({ p, i })).filter(({ i }) => !montrees.has(i));

    return `
      ${essai.erreurs.length ? `<section aria-label="Erreur">${essai.erreurs.map(e => blocErreur(e, t.statut === 'instable')).join('')}</section>` : ''}
      ${comparaisons.length ? `<section><div class="titre-section"><h2>Comparaison visuelle</h2><p class="discret">Attendu = référence validée · Obtenu = capture de ce lancement</p></div>${comparaisons.map(c => comparateur(c, essai)).join('')}</section>` : ''}
      ${etapes.length ? `<section><div class="titre-section"><h2>Étapes</h2><p class="discret">${pluriel(etapes.length, 'étape', 'étapes')} · ${esc(duree(essai.duree))}</p></div>${listeEtapes(etapes, essai)}</section>` : ''}
      ${essai.video >= 0 && urlPiece(essai.pieces[essai.video]) ? `<section><h2 style="margin-bottom:14px">Vidéo</h2><video controls preload="metadata" src="${esc(urlPiece(essai.pieces[essai.video]))}"${affiche(essai) ? ` poster="${esc(affiche(essai))}"` : ''} style="max-height:80vh;border:1px solid var(--trait)"></video></section>` : ''}
      ${autres.length ? `<section><h2 style="margin-bottom:14px">Autres pièces jointes</h2><div class="pieces">${autres.map(({ p }) => vuePiece(p)).join('')}</div></section>` : ''}
      ${essai.sortie || essai.erreursConsole ? `<section><h2 style="margin-bottom:14px">Journal du test</h2>
        ${essai.sortie ? `<details class="repli"><summary>Sortie standard</summary><pre class="code">${esc(essai.sortie)}</pre></details>` : ''}
        ${essai.erreursConsole ? `<details class="repli"><summary>Erreurs</summary><pre class="code">${esc(essai.erreursConsole)}</pre></details>` : ''}</section>` : ''}`;
  }

  function blocErreur(e, instable) {
    return `
      <div class="erreur ${instable ? 'erreur--instable' : ''}">
        <p class="erreur__resume">${esc(e.resume)}</p>
        ${e.precisions.length ? `<ul>${e.precisions.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        ${e.emplacement ? `<p class="mini" style="margin:12px 0 0">Dans ${esc(e.emplacement)}</p>` : ''}
        <details><summary>Détails techniques</summary>
          ${e.extrait ? `<pre class="code">${esc(e.extrait)}</pre>` : ''}
          <pre class="code">${esc(e.message)}</pre>
          ${e.pile && !e.message.includes(e.pile) ? `<pre class="code">${esc(e.pile)}</pre>` : ''}
        </details>
      </div>`;
  }

  function listeEtapes(etapes, essai) {
    const total = Math.max(1, essai.duree);
    return `<ol class="etapes">${etapes.map(e => {
      const enEchec = !!e.erreur;
      const images = e.pieces.map(i => essai.pieces[i]).filter(p => p?.type.startsWith('image/') && p.chemin);
      const enfants = e.enfants.filter(x => x.categorie !== 'test.attach');
      return `
        <li class="etape ${enEchec ? 'etape--echec' : ''}">
          <div class="etape__ligne">
            ${enEchec ? puceBrute('echec', 'Étape en échec') : puceBrute('reussi', 'Étape réussie')}
            <div><div class="etape__titre">${esc(e.titre)}</div>${e.erreur ? `<div class="etape__erreur">${esc(e.erreur)}</div>` : ''}</div>
            <div class="etape__temps" data-info="${esc(`Commence à ${duree(e.debut)}, dure ${duree(e.duree)}`)}"><i style="left:${(e.debut / total) * 100}%;width:${Math.max(0.5, (e.duree / total) * 100)}%"></i></div>
            <div class="etape__duree">${esc(duree(e.duree))}</div>
          </div>
          <div class="etape__corps">${enfants.length ? `<details ${enEchec ? 'open' : ''}><summary>Détail des actions (${enfants.length})</summary>${sousEtapes(enfants)}</details>` : (images.length ? '<div></div>' : '')}${images.map(p => `<button type="button" class="miniature" data-image="${esc(p.chemin)}" data-legende="${esc(e.titre)}" aria-label="Agrandir la capture de l'étape ${esc(e.titre)}"><img loading="lazy" src="${esc(p.chemin)}" alt=""></button>`).join('')}</div>
        </li>`;
    }).join('')}</ol>`;
  }

  function sousEtapes(etapes) {
    return `<ul class="sous-etapes">${etapes.map(e => {
      const enfants = e.enfants.filter(x => x.categorie !== 'test.attach');
      const ligne = `<span>${esc(e.titre)}</span><span class="chiffres">${esc(duree(e.duree))}</span>`;
      return enfants.length
        ? `<li class="parent ${e.erreur ? 'ko' : ''}"><div>${ligne}</div>${sousEtapes(enfants)}</li>`
        : `<li class="${e.erreur ? 'ko' : ''}">${ligne}</li>`;
    }).join('')}</ul>`;
  }

  function vuePiece(p) {
    const lien = p.chemin ? `<a href="${esc(p.chemin)}" download class="discret">Télécharger · ${esc(taille(p.taille))}</a>` : '<span class="discret">fichier absent</span>';
    if (p.type.startsWith('image/') && p.chemin) {
      return `<div class="piece"><div class="piece__titre"><span>${esc(p.nom)}</span>${lien}</div><button type="button" class="miniature" data-image="${esc(p.chemin)}" data-legende="${esc(p.nom)}"><img loading="lazy" src="${esc(p.chemin)}" alt="${esc(p.nom)}"></button></div>`;
    }
    if (p.texte != null) {
      return `<div class="piece piece--large"><div class="piece__titre"><span>${esc(p.nom)}</span>${lien}</div><details><summary>Afficher</summary><pre class="code">${esc(p.texte)}</pre></details></div>`;
    }
    return `<div class="piece"><div class="piece__titre"><span>${esc(p.nom)}</span></div>${lien}</div>`;
  }

  function comparateur(c, essai) {
    const src = i => (i != null ? urlPiece(essai.pieces[i]) : null);
    const attendu = src(c.attendu), obtenu = src(c.obtenu), difference = src(c.difference);
    const modes = [
      attendu && obtenu && ['cote', 'Côte à côte'],
      attendu && obtenu && ['rideau', 'Curseur'],
      difference && ['difference', 'Différence'],
      attendu && ['attendu', 'Attendu'],
      obtenu && ['obtenu', 'Obtenu'],
    ].filter(Boolean);
    const initial = modes[0][0];
    return `
      <div class="comparateur" data-comparateur data-attendu="${esc(attendu ?? '')}" data-obtenu="${esc(obtenu ?? '')}" data-difference="${esc(difference ?? '')}" data-nom="${esc(c.nom)}">
        <div class="comparateur__barre">
          <strong>${esc(c.nom)}</strong>
          <div class="modes" role="group" aria-label="Mode d'affichage">${modes.map(([cle, libelle]) => `<button type="button" data-mode="${cle}" aria-pressed="${cle === initial}">${libelle}</button>`).join('')}</div>
          <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-taille-reelle> Taille réelle</label>
        </div>
        <div class="comparateur__vue" data-vue></div>
      </div>`;
  }

  function dessinerComparateur(bloc, mode) {
    const { attendu, obtenu, difference, nom } = bloc.dataset;
    const vue = bloc.querySelector('[data-vue]');
    const reelle = bloc.querySelector('[data-taille-reelle]').checked ? 'taille-reelle' : '';
    bloc.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const image = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt)}" style="width:100%">`;
    if (mode === 'cote') {
      vue.innerHTML = `
        <div class="cote-a-cote ${reelle}">
          <div><span class="capitales">Attendu · référence</span><div class="defile" data-sync>${image(attendu, `${nom} attendu`)}</div></div>
          <div><span class="capitales">Obtenu · ce lancement</span><div class="defile" data-sync>${image(obtenu, `${nom} obtenu`)}</div></div>
        </div>`;
      // Défilement synchronisé des deux captures.
      const [a, b] = vue.querySelectorAll('[data-sync]');
      let verrou = false;
      const suivre = (source, cible) => source.addEventListener('scroll', () => {
        if (verrou) return;
        verrou = true;
        cible.scrollTop = source.scrollTop;
        cible.scrollLeft = source.scrollLeft;
        requestAnimationFrame(() => { verrou = false; });
      });
      suivre(a, b);
      suivre(b, a);
    } else if (mode === 'rideau') {
      vue.innerHTML = `
        <div class="rideau-reglage"><span>Attendu</span><input type="range" min="0" max="100" value="50" aria-label="Position du curseur"><span>Obtenu</span></div>
        <div class="defile ${reelle}"><div class="rideau">
          ${image(attendu, `${nom} attendu`)}
          <div class="rideau__dessus" style="clip-path:inset(0 0 0 50%)">${image(obtenu, `${nom} obtenu`)}</div>
          <div class="rideau__trait" style="left:50%"></div>
        </div></div>
        <p class="comparateur__note" style="margin:10px 0 0">À gauche du trait : la référence. À droite : la capture de ce lancement.</p>`;
      const curseur = vue.querySelector('input');
      const dessus = vue.querySelector('.rideau__dessus');
      const trait = vue.querySelector('.rideau__trait');
      curseur.addEventListener('input', () => {
        dessus.style.clipPath = `inset(0 0 0 ${curseur.value}%)`;
        trait.style.left = `${curseur.value}%`;
      });
    } else {
      const src = { difference, attendu, obtenu }[mode];
      const note = {
        difference: 'En rouge : les pixels qui ont changé. En jaune : les légères nuances tolérées. Le reste est grisé.',
        attendu: 'La référence validée (« état validé »).',
        obtenu: attendu ? 'La capture de ce lancement.' : 'La capture de ce lancement. Pas encore de référence : elle a été enregistrée comme référence.',
      }[mode];
      vue.innerHTML = `<p class="comparateur__note">${esc(note)}</p><div class="defile ${reelle}">${image(src, `${nom} ${mode}`)}</div>`;
    }
  }

  function brancherTest(t, params) {
    document.querySelectorAll('[data-essai]').forEach(b => b.addEventListener('click', () => {
      const p = new URLSearchParams(params);
      p.set('essai', b.dataset.essai);
      location.hash = `#/test/${encodeURIComponent(t.id)}?${p}`;
    }));
    document.querySelectorAll('[data-comparateur]').forEach(bloc => {
      let mode = bloc.querySelector('[data-mode][aria-pressed="true"]').dataset.mode;
      dessinerComparateur(bloc, mode);
      bloc.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; dessinerComparateur(bloc, mode); }));
      bloc.querySelector('[data-taille-reelle]').addEventListener('change', () => dessinerComparateur(bloc, mode));
    });
  }

  rendre();
})();
