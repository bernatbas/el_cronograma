/* =============================================================================
 * db.js — LA BASE DE DADES. Aquí s'edita el contingut.
 *
 * La carreguen LES DUES pàgines: el cronograma (index.html) i els jocs (joc.html).
 * Abans vivia dins de l'index.html i es copiava a data.js per al joc; aquella còpia
 * s'havia de regenerar a cada canvi i es podia quedar endarrerida. Ara n'hi ha una
 * de sola.
 *
 * ⚠️ És un script CLÀSSIC a posta, no un mòdul i no un JSON: les `const` de dalt de tot
 *    queden visibles per a l'script de la pàgina, i això funciona amb doble clic
 *    (file://), que és com s'obre sovint. Amb `fetch` o `import` el navegador ho
 *    bloquejaria i la pàgina es quedaria sense dades.
 *
 * ⚠️ S'ha de carregar ABANS de l'script de la pàgina. No depèn de res: dins només hi ha
 *    Date, Set, console i mètodes d'array — cap `t()` ni `L()`.
 *
 * El dashboard (_tools/dash.py) escriu aquí. Es pot editar a mà, amb compte amb els
 * apòstrofs (veure CLAUDE.md).
 * ============================================================================= */

// ============================================================
// [1] DATA  —  edit here to add eras, events and people.
// Years: negative = aC. A person with death:null is alive (fades to the future).
// Apostrophes inside these strings MUST be written ' (single-quoted JS literals).
// ============================================================
const CAT_COLORS={
  'philosophy':'#5E9FE8','music':'#BF8EDA','literature':'#DE9255',
  'science':'#72BC8F','politics':'#DF84A8','painting':'#D4A72C','religion':'#A24E5E',
  'sport':'#94AD3C','cinema':'#FF7875'
};
const NOW_YEAR=new Date().getFullYear();
// COL·LECCIONS: playlists de persones. Guarden **Q-ids, no persones** — la mateixa referència
// resol a una entrada de PEOPLE si la tenim en local, i es baixa de Wikidata si no, així una
// col·lecció pot incloure qualsevol (aquí Descartes, Camus i Sartre no són a la DB local).
// ── Sostres d'una col·lecció ──────────────────────────────────────────────────
// Dos límits diferents, i el que mana és el primer:
//
// COLL_MAX (60) — límit d'USABILITAT. Els carrils s'apilen en vertical, i quants en
//   surten depèn de com estigui repartida la gent, no només de quanta n'hi hagi:
//   mesurat, 100 persones repartides per 160 anys fan 45 carrils, però els 49 Nobel
//   —que es solapen gairebé tots— ja en fan 39. El pitjor cas és «tothom coincideix»,
//   i allà carrils ≈ persones. Amb 60 això són ~60 carrils ≈ 2.160px ≈ 3 pantalles de
//   scroll vertical, que és el màxim que encara es deixa llegir d'una passada.
//
// WD_IDS_MAX (350) — límit TÈCNIC de byIds(), que envia TOTS els Q-ids en UNA sola
//   consulta SPARQL. Wikidata la talla per llargada d'URL: mesurat, 400 ids van bé
//   (6.281 chars), 600 donen 414 URI Too Long (9.180 chars) i 989 donen 503. 350 deixa
//   marge per si els ids són llargs. Si algun dia cal passar d'aquí, la solució NO és
//   apujar el número sinó partir la petició en trossos dins de byIds().
//
// Passar-se de COLL_MAX no trenca res: el guard de sota talla la llista i ho diu per
// consola. El CI, en canvi, hi peta a propòsit, perquè no arribi mai a producció.
const COLL_MAX=60, WD_IDS_MAX=350;
const COLLECTIONS=[
  {id:'filosofs',name:'Els meus filòsofs',wds:[
    'Q913',   // Sòcrates      (local)
    'Q859',   // Plató         (local)
    'Q868',   // Aristòtil     (local)
    'Q59180', // Diògenes      (local)
    'Q2054',  // Sèneca        ~4aC–65
    'Q183144',// Epictet        50–135
    'Q1430',  // Marc Aureli   121–180
    'Q9438',  // Tomàs d'Aquino 1225–1274
    'Q1399',  // Maquiavel     1469–1527
    'Q9191',  // René Descartes 1596–1650
    'Q37621', // Thomas Hobbes 1588–1679
    'Q37160', // David Hume    1711–1776
    'Q6527',  // Rousseau      1712–1778
    'Q9312',  // Immanuel Kant 1724–1804
    'Q9235',  // Hegel         1770–1831
    'Q9358',  // Nietzsche     1844–1900
    'Q34670', // Albert Camus  1913–1960
    'Q9364'   // Jean-Paul Sartre 1905–1980
  ]},
  {id:'nobel',name:'Il·lustres premis Nobel',url:'https://www.nobelprize.org/prizes/lists/all-nobel-prizes/',wds:[
    // Els 8 amb més presència a les Viquipèdies de cada categoria (el mateix senyal de
    // rellevància que fa servir el motor de zoom dels events), més el senyor Nobel obrint
    // la fila. Equilibrat a propòsit: per pur nombre de sitelinks sortien 22 de Literatura
    // i CAP de Medicina ni d’Economia.
    // — qui va crear el premi —
    'Q23810',    // Alfred Nobel               1833–1896 
    // — Física —
    'Q35149',    // Wilhelm Röntgen            1845–1923 
    'Q9021',     // Max Planck                 1858–1947 
    'Q7186',     // Marie Curie                1867–1934  (local) +Química
    'Q937',      // Albert Einstein            1879–1955  (local)
    'Q7085',     // Niels Bohr                 1885–1962 
    'Q9130',     // Erwin Schrödinger          1887–1961 
    'Q8753',     // Enrico Fermi               1901–1954 
    'Q39246',    // Richard Feynman            1918–1988 
    // — Química —
    'Q102822',   // J. H. van ’t Hoff           1852–1911 
    'Q80956',    // Svante August Arrhenius    1859–1927 
    'Q57075',    // Fritz Haber                1868–1934 
    'Q9123',     // Ernest Rutherford          1871–1937 
    'Q57065',    // Otto Hahn                  1879–1968 
    'Q7504',     // Irène Joliot-Curie         1897–1956 
    'Q48983',    // Linus Carl Pauling         1901–1994  +Pau
    'Q7487',     // Dorothy Crowfoot Hodgkin   1910–1994 
    // — Medicina —
    'Q37193',    // Robert Koch                1843–1910 
    'Q42985',    // Ivan Petróvitx Pàvlov      1849–1936 
    'Q102034',   // Ronald Ross                1857–1932 
    'Q37064',    // Alexander Fleming          1881–1955  (local)
    'Q78496',    // Konrad Lorenz              1903–1989 
    'Q185007',   // Rita Levi-Montalcini       1909–2012 
    'Q123280',   // Francis Crick              1916–2004 
    'Q83333',    // James Dewey Watson         1928–2025 
    // — Literatura —
    'Q19185',    // George Bernard Shaw        1856–1950 
    'Q7241',     // Rabindranath Tagore        1861–1941 
    'Q34743',    // Rudyard Kipling            1865–1936 
    'Q8016',     // Winston Churchill          1874–1965  (local)
    'Q23434',    // Ernest Miller Hemingway    1899–1961 
    'Q9364',     // Jean-Paul Sartre           1905–1980 
    'Q34670',    // Albert Camus               1913–1960 
    'Q5878',     // Gabriel García Márquez     1927–2014 
    // — Pau —
    'Q34296',    // Woodrow Wilson             1856–1924 
    'Q33866',    // Theodore Roosevelt         1858–1919 
    'Q30547',    // Teresa de Calcuta          1910–1997 
    'Q8023',     // Nelson Mandela             1918–2013  (local)
    'Q23685',    // James Earl Carter          1924–2024 
    'Q8027',     // Martin Luther King         1929–1968 
    'Q30487',    // Mikhaïl Gorbatxov          1931–2022 
    'Q76',       // Barack Obama               1961–avui 
    // — Economia (Banc de Suècia) —
    'Q1325',     // Friedrich August von Hayek 1899–1992 
    'Q47426',    // Milton Friedman            1912–2006 
    'Q102454',   // Paul Samuelson             1915–2009 
    'Q128736',   // John Forbes Nash           1928–2015 
    'Q132489',   // Amartya Sen                1933–avui 
    'Q153761',   // Elinor Ostrom              1933–2012 
    'Q18430',    // Joseph Eugene Stiglitz     1943–avui 
    'Q131112'    // Paul Krugman               1953–avui 
  ]},

  {id:'calbs',name:'Calbs il·lustres',wds:[
    // Curada A MA i a ull: Wikidata te la calvicie anotada (P1884) a QUATRE persones en
    // total, aixi que aqui no hi ha cap consulta al darrere ni cap check que la validi.
    //
    // El criteri no es «surt calb en una foto» sino «quan hi penses, saps que es calb»:
    // ha de ser part de com te’l imagines. Per aixo en van caure set d’una primera versio:
    // en Connery el recordes de Bond i alla duia perruqui, en Ronaldo amb el tall del 2002,
    // en Samuel L. Jackson amb els rinxols del Pulp Fiction; l’Anthony Hopkins te entrades,
    // no es calb; i en Bunyuel, l’Onassis i en Diaguilev son calbs pero no es aixi com se’ls
    // recorda —el darrer, directament, no es cultura general.
    //
    // ⚠️ Nomes de 1809 enca, i no per mandra: saber si algu era calb demana un retrat
    // REALISTA, i hi ha dos forats insalvables —del 400 al 1400 l’art no es naturalista (la
    // tonsura dels monjos es afaitada, no calvicie) i del 1650 al 1800 tothom porta perruca.
    // Omplir-ho amb romans, que si que estan documentats (Suetoni explica que Domicia va
    // escriure un llibre sobre cura del cabell), donaria un grumoll antic, 1.400 anys de buit
    // i un grumoll modern: la mateixa forma lletja pero amb dos pics.
    'Q1035',     // Charles Robert Darwin       1809–1882    (local)
    'Q8442',     // Otto von Bismarck           1815–1898   
    'Q160278',   // John D. Rockefeller         1839–1937   
    'Q1001',     // Mohandas Gandhi             1869–1948    (local)
    'Q1394',     // Lenin                       1870–1924   
    'Q8016',     // Winston Churchill           1874–1965    (local)
    'Q208537',   // Pau Casals                  1876–1973   
    'Q5593',     // Pablo Picasso               1881–1973    (local)
    'Q23559',    // Benito Mussolini            1883–1945   
    'Q9916',     // Dwight David Eisenhower     1890–1969   
    'Q35314',    // Nikita Khrusxov             1894–1971   
    'Q7374',     // Alfred Hitchcock            1899–1980   
    'Q102813',   // Yul Brynner                 1920–1985   
    'Q209471',   // Telly Savalas               1922–1994   
    'Q44272',    // Michel Foucault             1926–1984   
    'Q30487',    // Mikhaïl Gorbatxov           1931–2022   
    'Q16296',    // Patrick Stewart             1940–avui   
    'Q173158',   // Ben Kingsley                1943–avui   
    'Q26806',    // Danny DeVito                1944–avui   
    'Q2680',     // Bruce Willis                1955–avui   
    'Q19837',    // Steve Jobs                  1955–2011   
    'Q41421',    // Michael Jordan              1963–avui   
    'Q7407',     // Andre Agassi                1970–avui   
    'Q164038',   // Josep Guardiola i Sala      1971–avui   
    'Q1835'      // Zinédine Zidane             1972–avui   
  ]},
  {id:'religions',name:'Fundadors de religions',wds:[
    // El contingut d’aquesta col·leccio NO es qui hi ha, es QUAN. Dues coses alhora:
    //
    // 1) EL NUS. Mahavira (-599), Laozi (-580), Confuci (-551) i el Buda (-501) neixen dins
    //    del mateix segle, a la Xina i a l’India, sense saber els uns dels altres. S’inventen
    //    per separat el jainisme, el taoisme, el confucianisme i el budisme. Karl Jaspers en
    //    va dir «era axial». En un llibre son quatre capitols separats per geografia; aqui es
    //    UNA COLUMNA, i la columna es el fet.
    //    ⚠️ Els anys no son sempre els tradicionals de la bibliografia, sino els del rang
    //    PREFERIT de Wikidata, que es el que segueix la SPARQL: Laozi surt a -580 i no a -604.
    //    Si toques aquest comentari, mira ABANS que diu el canvas.
    // 2) EL REPARTIMENT. Despres el ritme no s’atura: Jesus, Mani, Mahoma, Nanak, la
    //    Reforma, i una pluja al segle XIX-XX (Smith, Bahá’u’lláh, Eddy, Russell, Hubbard).
    //    Fundar religions no es cosa «dels antics»: passa a cada epoca.
    //
    // ⚠️ Tres que hi haurien de ser i no hi son, cada una per un motiu diferent — i les TRES
    // desapareixerien EN SILENCI si no s’hi para compte (detall a CLAUDE.md):
    //   · Mahavira: el seu P31 a Wikidata es «tirthankara» i «esser huma possiblement
    //     fictici», no Q5, i byIds(humansOnly=true) el filtra. Per aixo es a PEOPLE en local.
    //   · El Buda tambe es a PEOPLE en local, pero per un altre motiu: a Wikidata el P569 i el
    //     P570 PREFERITS son tots dos -0500 —es com hi modelen «segle V aC»— i per la SPARQL
    //     naixia i moria el mateix any: una barra de 8px, el minim que pinta render(). En local
    //     hi va amb les dates tradicionals (-563/-483), que a Wikidata hi son amb rang normal.
    //   · Zaratustra: te P569 = -628 amb rang NORMAL, pero la declaracio PREFERIDA es «sense
    //     valor» —les seves dates son disputades de debo— i wdt:P569 segueix el rang preferit,
    //     aixi que la SPARQL no torna data i wdParse el descarta. Fora: no vull sostenir el
    //     nus axial amb una data que la font declina afirmar.
    //   · Christine de Pizan: directament no te any de naixement a Wikidata.
    'Q9333',     // Laozi                       -604–-500             taoisme
    'Q9422',     // Mahavira                    -599–-527    (local)  jainisme
    'Q9441',     // Buda                        -563–-483             budisme
    'Q4604',     // Confuci                     -551–-479    (local)  confucianisme
    'Q302',      // Jesucrist                   -4–30        (local)  cristianisme
    'Q203922',   // Mani                        216–274               maniqueisme
    'Q9458',     // Mahoma                      571–632      (local)  islam
    'Q83322',    // Guru Nanak                  1469–1539             sikhisme
    'Q9554',     // Martí Luter                 1483–1546    (local)  protestantisme
    'Q37577',    // Joan Calví                  1509–1564             calvinisme
    'Q47102',    // Joseph Smith                1805–1844             mormonisme
    'Q101054',   // Bahá’u’lláh                 1817–1892             fe bahà’í
    'Q235069',   // Mary Baker Eddy             1821–1910             Ciència Cristiana
    'Q313456',   // Charles Taze Russell        1852–1916             testimonis de Jehovà
    'Q216896'    // L. Ron Hubbard              1911–1986             cienciologia
  ]},
  {id:'dones',name:'Dones a la història',wds:[
    // Aqui el contingut tampoc es qui hi ha: es la DENSITAT, i sobretot el que falta.
    // Compta les barres per tram i miralestes d’esquerra a dreta —3 abans de Crist, 2 fins
    // l’any 1000, 4 fins al 1500, 6 fins al 1800 i 16 despres— i tens la forma de la
    // col·leccio: un degoteig que s’espesseix. Aixo NO vol dir que hi hagues menys dones
    // abans; vol dir que se’n va registrar menys. La col·leccio ensenya l’estat de l’ARXIU,
    // no el de la humanitat, i aquesta diferencia es tot el que hi ha per aprendre-hi.
    //
    // Per aixo NO s’ha d’«equilibrar» afegint-ne d’antigues fins que quedi pla: seria
    // maquillar justament el que la fa valer la pena.
    'Q129234',   // Hatxepsut                   -1507–-1458         
    'Q17892',    // Safo de Lesbos              -650–-550           
    'Q635',      // Cleopatra                   -69–-30      (local)
    'Q184634',   // Boudica                     30–61               
    'Q11903',    // Hipàcia                     360–415             
    'Q70991',    // Hildegarda de Bingen        1098–1179           
    'Q178525',   // Elionor d’Aquitània         1124–1204           
    'Q7226',     // Joana d’Arc                 1412–1431    (local)
    'Q45859',    // Isabel I de Castella        1451–1504    (local)
    'Q131552',   // Caterina de Mèdici          1519–1589    (local)
    'Q7207',     // Elisabet I d’Anglaterra     1533–1603           
    'Q212657',   // Artemisia Gentileschi       1593–1653           
    'Q183074',   // Sor Juana Inés              1648–1695           
    'Q101638',   // Mary Wollstonecraft         1759–1797    (local)
    'Q36322',    // Jane Austen                 1775–1817    (local)
    'Q7259',     // Ada Lovelace                1815–1852    (local)
    'Q80137',    // Emily Brontë                1818–1848           
    'Q44520',    // Anne Brontë                 1820–1849           
    'Q37103',    // Florence Nightingale        1820–1910           
    'Q211519',   // Emmeline Pankhurst          1858–1928           
    'Q7186',     // Marie Curie                 1867–1934    (local)
    'Q7231',     // Rosa Luxemburg              1871–1919    (local)
    'Q40909',    // Virginia Woolf              1882–1941    (local)
    'Q60025',    // Hannah Arendt               1906–1975           
    'Q5588',     // Frida Kahlo                 1907–1954    (local)
    'Q7197',     // Simone de Beauvoir          1908–1986    (local)
    'Q41921',    // Rosa Parks                  1913–2005           
    'Q7474',     // Rosalind Franklin           1920–1958           
    'Q4583',     // Anne Frank                  1929–1945    (local)
    'Q133054',   // Sylvia Plath                1932–1963           
    'Q1744'      // Madonna                     1958–avui    (local)
  ]},
  {id:'maricashistoria',name:'Grandes Maricas de la Historia',url:'https://grandesmaricasdelahistoria.es/',wds:[
    'Q1762',  // Heliogàbal          203–222
    'Q762',   // Leonardo da Vinci   1452–1519
    'Q5592',  // Miquel Àngel        1475–1564
    'Q692',   // Shakespeare         1564–1616
    'Q183074',// Sor Juana Inés      1649–1695
    'Q33550', // Frederic II Prússia 1712–1786
    'Q5679',  // Lord Byron          1788–1824
    'Q7315',  // Txaikovski          1840–1893
    'Q30875', // Oscar Wilde         1854–1900
    'Q40909', // Virginia Woolf      1882–1941
    'Q41408', // García Lorca        1898–1936
    'Q7251'   // Alan Turing         1912–1954
  ]},
  // Filosofia de la ciència: els autors i els casos històrics de «Què és aquesta cosa anomenada
  // ciència?» (Chalmers), per a l'assignatura de la UNED. Q-ids resolts pel títol de l'article de la
  // Viquipèdia i verificats amb l'any esperat i la mateixa SPARQL que byIds() (16/11/2026).
  {id:'ipcuned',name:'IPC - UNED 2026',wds:[
    'Q37388',   // Francis Bacon       1561–1626
    'Q37160',   // David Hume          1711–1776
    'Q81244',   // Karl Popper         1902–1994
    'Q184980',  // Thomas Kuhn         1922–1996
    'Q296249',  // Imre Lakatos        1922–1974
    'Q78497',   // Paul Feyerabend     1924–1994
    'Q314172',  // Pierre Duhem        1861–1916
    'Q214969',  // W. V. O. Quine      1908–2000
    'Q208452',  // Thomas Bayes        1702–1761
    'Q16732191',// Deborah Mayo        1953–
    'Q188357',  // Ian Hacking         1936–2023
    'Q809744',  // Bas van Fraassen    1941–
    'Q321606',  // John Worrall        1946–
    'Q619',     // Copèrnic            1473–1543
    'Q36620',   // Tycho Brahe         1546–1601
    'Q8963',    // Kepler              1571–1630
    'Q307',     // Galileu             1564–1642
    'Q935',     // Isaac Newton        1643–1727
    'Q104154',  // Le Verrier          1811–1877
    'Q20015',   // John Couch Adams    1819–1892
    'Q39607',   // Lavoisier           1743–1794
    'Q159636',  // Joseph Priestley    1733–1804
    'Q8750',    // Michael Faraday     1791–1867
    'Q9095',    // James Clerk Maxwell 1831–1879
    'Q41257',   // Heinrich Hertz      1857–1894
    'Q59736',   // Ignaz Semmelweis    1818–1865   (de la col·lecció local d'en Bernat)
    'Q937'      // Albert Einstein     1879–1955
  ]}
];

// Xarxa de seguretat per a l'edicio a ma: una col·leccio que passi de COLL_MAX es talla
// (no es trenca la vista) i es diu per consola. El check del CI hi peta, aixi que en
// condicions normals aixo no s'executa mai.
COLLECTIONS.forEach(c=>{
  if(!Array.isArray(c.wds))
    {console.error('[HB] La col·leccio «'+c.id+'» no te llista de Q-ids');c.wds=[];return;}
  const dup=c.wds.length-new Set(c.wds).size;
  if(dup)console.warn('[HB] La col·leccio «'+c.id+'» te '+dup+' Q-id(s) repetits');
  const mal=c.wds.filter(q=>!/^Q\d+$/.test(q));
  if(mal.length)console.error('[HB] Q-ids amb format incorrecte a «'+c.id+'»: '+mal.join(', '));
  if(c.wds.length>COLL_MAX){
    console.error('[HB] La col·leccio «'+c.id+'» te '+c.wds.length+' persones i el sostre es '
      +COLL_MAX+': es queden les '+COLL_MAX+' primeres. Parteix-la en col·leccions mes petites.');
    c.wds=c.wds.slice(0,COLL_MAX);
  }
});

// ERES: the always-on backbone — the macro-eras that act as the "ruler" of the timeline.
// Not a toggleable marc; rendered as a pale wash spanning the whole eras canvas.
const ERAS_COLOR='#8B93AD';
const ERAS=[
  {name:'Prehistòria',start:-12000,end:-3300},
  {name:'Edat Antiga',start:-3300,end:476},
  {name:'Edat Mitjana',start:476,end:1492},
  {name:'Edat Moderna',start:1492,end:1789},
  {name:'Edat Contemporània',start:1789,end:NOW_YEAR}
];
// MARCS: toggleable historical frames. Each is a set of period `blocks`, told apart by colour.
// All blocks render identically (same size/shape) and share the same stacking area over the eras.
// Add more frames here later (Amèrica, Àsia…) — each just needs a colour and its blocks.
const MARCS=[
  {id:'west',name:'Occident',color:'#5E9FE8',blocks:[
    {name:'Paleolític',start:-12000,end:-9000,wiki:'https://ca.wikipedia.org/wiki/Paleolític'},
    {name:'Neolític',start:-9000,end:-3000,wiki:'https://ca.wikipedia.org/wiki/Neolític'},
    {name:'Edat dels Metalls',start:-3000,end:-800,wiki:'https://ca.wikipedia.org/wiki/Edat_dels_metalls'},
    {name:'Primeres civilitzacions',start:-3300,end:-500,wiki:'https://ca.wikipedia.org/wiki/Bressol_de_la_civilització'},
    {name:'Grècia clàssica',start:-800,end:-323,wiki:'https://ca.wikipedia.org/wiki/Antiga_Grècia'},
    {name:'Hel·lenisme',start:-323,end:-31,wiki:'https://ca.wikipedia.org/wiki/Hel·lenisme'},
    {name:'República romana',start:-509,end:-27,wiki:'https://ca.wikipedia.org/wiki/República_Romana'},
    {name:'Imperi Romà',start:-27,end:476,wiki:'https://ca.wikipedia.org/wiki/Imperi_Romà'},
    {name:'Alta edat mitjana',start:476,end:1000,wiki:'https://ca.wikipedia.org/wiki/Alta_edat_mitjana'},
    {name:'Plena edat mitjana',start:1000,end:1300,wiki:'https://ca.wikipedia.org/wiki/Plena_edat_mitjana'},
    {name:'Baixa edat mitjana',start:1300,end:1492,wiki:'https://ca.wikipedia.org/wiki/Baixa_edat_mitjana'},
    {name:'Renaixement',start:1400,end:1600,wiki:'https://ca.wikipedia.org/wiki/Renaixement'},
    {name:'Barroc',start:1600,end:1750,wiki:'https://ca.wikipedia.org/wiki/Barroc'},
    {name:'Il·lustració',start:1685,end:1789,wiki:'https://ca.wikipedia.org/wiki/Il·lustració'},
    {name:'Romanticisme',start:1800,end:1850,wiki:'https://ca.wikipedia.org/wiki/Romanticisme'},
    {name:'Realisme i positivisme',start:1850,end:1900,wiki:'https://ca.wikipedia.org/wiki/Realisme'},
    {name:'Avantguardes',start:1905,end:1945,wiki:'https://ca.wikipedia.org/wiki/Avantguardisme'},
    {name:'Món contemporani',start:1945,end:NOW_YEAR,wiki:'https://ca.wikipedia.org/wiki/Edat_contemporània'}
  ]},
  {id:'es',name:'Espanya',color:'#C2A07C',blocks:[
    {name:'Antic Règim borbònic',start:1700,end:1808,wiki:'https://ca.wikipedia.org/wiki/Antic_Règim'},
    {name:'Construcció de l’estat liberal a Espanya',start:1808,end:1874,wiki:'https://ca.wikipedia.org/wiki/Construcci%C3%B3_de_l%27estat_liberal_a_Espanya'},
    {name:'Restauració',start:1874,end:1931,wiki:'https://ca.wikipedia.org/wiki/Restauració_borbònica'},
    {name:'II República',start:1931,end:1939,wiki:'https://ca.wikipedia.org/wiki/Segona_República_Espanyola'},
    {name:'Franquisme',start:1939,end:1975,wiki:'https://ca.wikipedia.org/wiki/Franquisme'}
  ]}
];
const EVENTS=[
  {id:'agricultura',name:'Revolució agrícola',year:-10000,wiki:'https://ca.wikipedia.org/wiki/Neol%C3%ADtic',sitelinks:128,desc:'Transició dels grups humans de la caça i la recol·lecció a l’agricultura sedentària; origen de les primeres civilitzacions.'},
  {id:'roda',name:'Invenció de la roda',year:-3500,wiki:'https://ca.wikipedia.org/wiki/Roda',sitelinks:180,desc:'La roda i l’eix apareixen a la Mesopotàmia, transformant el transport, la manufactura i la guerra.'},
  {id:'escriptura',name:'Invenció de l’escriptura',year:-3300,wiki:'https://ca.wikipedia.org/wiki/Hist%C3%B2ria_de_l%27escriptura',sitelinks:42,desc:'Els sumeris inventen els primers sistemes d’escriptura cuneïforme, marcant el pas de la Prehistòria a l’Edat Antiga.'},
  {id:'romaFund',name:'Fundació de Roma',year:-753,wiki:'https://ca.wikipedia.org/wiki/Fundaci%C3%B3_de_Roma',sitelinks:45,desc:'Fundació llegendària de Roma per Ròmul, origen d’una de les civilitzacions més influents de la història occidental.'},
  {id:'caigudaimp',name:'Caiguda de l’Imperi Romà',year:476,wiki:'https://ca.wikipedia.org/wiki/Caiguda_de_l%27Imperi_Rom%C3%A0_d%27Occident',sitelinks:56,desc:'Odoacre deposa l’últim emperador romà d’Occident. Marca l’inici convencional de l’Edat Mitjana.'},
  {id:'hegira',name:'Hègira de Mahoma',year:622,wiki:'https://ca.wikipedia.org/wiki/H%C3%A8gira',sitelinks:93,desc:'Mahoma emigra de la Meca a Medina; inici del calendari islàmic i d’una expansió que transformarà el Mediterrani i l’Orient Pròxim.'},
  {id:'cartamagna',name:'Carta Magna',year:1215,wiki:'https://ca.wikipedia.org/wiki/Carta_Magna',sitelinks:97,desc:'Els barons anglesos obliguen el rei Joan a acceptar per escrit que el seu poder té límits; el primer document d’aquesta mena a Europa.'},
  {id:'pestaNegra',name:'Pesta Negra',year:1347,wiki:'https://ca.wikipedia.org/wiki/Pesta_negra',sitelinks:127,desc:'Epidèmia de pesta bubònica que mata entre un terç i la meitat de la població europea, accelerant la fi del feudalisme medieval.'},
  {id:'impremta',name:'Invenció de la impremta',year:1440,wiki:'https://ca.wikipedia.org/wiki/Impremta',sitelinks:79,desc:'Gutenberg combina tipus mòbils, tinta grassa i premsa: un llibre deixa de ser un objecte únic i el coneixement es pot copiar barat.'},
  {id:'constantinoble',name:'Caiguda de Constantinoble',year:1453,wiki:'https://ca.wikipedia.org/wiki/Caiguda_de_Constantinoble',sitelinks:79,desc:'Els otomans prenen la capital de l’Imperi Romà d’Orient. S’acaba l’últim tros de Roma, 1.480 anys després de la seva fundació.'},
  {id:'descamerica',name:'Descobriment d’Amèrica',year:1492,wiki:'https://ca.wikipedia.org/wiki/Descoberta_d%27Am%C3%A8rica',sitelinks:48,desc:'Cristòfor Colom arriba a les Amèriques el 12 d’octubre, obrint l’era dels grans imperis colonials. Inici convencional de l’Edat Moderna.'},
  {id:'reformaprot',name:'Reforma Protestant',year:1517,wiki:'https://ca.wikipedia.org/wiki/Reforma_protestant',sitelinks:154,desc:'Martí Luter publica les 95 tesis, trencant la unitat del cristianisme occidental i desencadenant guerres religioses arreu d’Europa.'},
  {id:'revolindust',name:'Revolució Industrial',year:1760,wiki:'https://ca.wikipedia.org/wiki/Revoluci%C3%B3_Industrial',sitelinks:161,desc:'L’aparició de la màquina de vapor a Anglaterra transforma l’economia, la societat i el paisatge urbà del món.'},
  {id:'independenciaeua',name:'Declaració d’Independència dels EUA',year:1776,wiki:'https://ca.wikipedia.org/wiki/Declaraci%C3%B3_d%27Independ%C3%A8ncia_dels_Estats_Units_d%27Am%C3%A8rica',sitelinks:94,desc:'Tretze colònies es declaren independents de la Gran Bretanya i funden la primera república moderna, tretze anys abans de la Revolució Francesa.'},
  {id:'revfr',name:'Revolució Francesa',year:1789,wiki:'https://ca.wikipedia.org/wiki/Revoluci%C3%B3_Francesa',sitelinks:193,desc:'Procés revolucionari que va enderrocar l’Antic Règim a França i va escampar per Europa els ideals de llibertat, igualtat i fraternitat.'},
  {id:'relativitat',name:'Teoria de la relativitat',year:1905,wiki:'https://ca.wikipedia.org/wiki/Teoria_de_la_relativitat',sitelinks:120,desc:'Einstein publica la relativitat especial: el temps i l’espai deixen de ser absoluts i passen a dependre de qui els mesura.'},
  {id:'wwi',name:'Inici de la Primera Guerra Mundial',year:1914,wiki:'https://ca.wikipedia.org/wiki/Primera_Guerra_Mundial',sitelinks:264,desc:'Esclat del primer conflicte a escala global, que va redibuixar el mapa polític i social del segle XX.'},
  {id:'revoluciorussa',name:'Revolució Russa',year:1917,wiki:'https://ca.wikipedia.org/wiki/Revoluci%C3%B3_Russa',sitelinks:117,desc:'Cau el tsarisme i els bolxevics prenen el poder: neix el primer estat comunista i amb ell mig segle de món partit en dos.'},
  {id:'penicilina',name:'Descoberta de la penicil·lina',year:1928,wiki:'https://ca.wikipedia.org/wiki/Penicil%C2%B7lina',sitelinks:114,desc:'Fleming veu que un fong ha matat els bacteris d’un cultiu oblidat. És el primer antibiòtic: abans, una infecció petita et podia matar.'},
  {id:'guerracivil',name:'Inici de la Guerra Civil espanyola',year:1936,wiki:'https://ca.wikipedia.org/wiki/Guerra_Civil_espanyola',sitelinks:119,desc:'Un cop d’estat fracassa a mitges i parteix el país en dos. Tres anys de guerra i quaranta de dictadura.'},
  {id:'wwii',name:'Inici de la Segona Guerra Mundial',year:1939,wiki:'https://ca.wikipedia.org/wiki/Segona_Guerra_Mundial',sitelinks:292,desc:'El conflicte més devastador de la història, amb 70-85 milions de víctimes. Acabà amb la creació de l’ONU i l’ordre bipolar de la Guerra Freda.'},
  {id:'hiroshima',name:'Bombardejos d’Hiroshima i Nagasaki',year:1945,wiki:'https://ca.wikipedia.org/wiki/Bombardejos_at%C3%B2mics_d%27Hiroshima_i_Nagasaki',sitelinks:93,desc:'Els Estats Units llancen dues bombes atòmiques sobre el Japó. Única vegada que s’han fet servir armes nuclears en una guerra.'},
  {id:'dretshumans',name:'Declaració Universal dels Drets Humans',year:1948,wiki:'https://ca.wikipedia.org/wiki/Declaraci%C3%B3_Universal_dels_Drets_Humans',sitelinks:178,desc:'Tres anys després de la guerra, l’ONU escriu què es deu a qualsevol persona pel simple fet de ser-ho.'},
  {id:'adn',name:'Descoberta de l’estructura de l’ADN',year:1953,wiki:'https://ca.wikipedia.org/wiki/%C3%80cid_desoxiribonucleic',sitelinks:175,desc:'Watson i Crick descriuen la doble hèlix, amb les dades de Rosalind Franklin. Darwin havia explicat l’evolució; això n’explica el mecanisme.'},
  {id:'apollo11',name:'Apollo 11',year:1969,wiki:'https://ca.wikipedia.org/wiki/Apollo_11',sitelinks:106,desc:'Armstrong i Aldrin caminen per la Lluna. Sis-cents milions de persones ho miren en directe.'},
  {id:'constitucio78',name:'Constitució espanyola de 1978',year:1978,wiki:'https://ca.wikipedia.org/wiki/Constituci%C3%B3_espanyola_de_1978',sitelinks:39,desc:'Tanca la dictadura i estableix el marc polític en què viu el país des d’aleshores.'},
  {id:'murberlin',name:'Caiguda del Mur de Berlín',year:1989,wiki:'https://ca.wikipedia.org/wiki/Caiguda_del_mur_de_Berl%C3%ADn',sitelinks:38,desc:'El novembre de 1989 cau el símbol de la Guerra Freda, obrint camí a la reunificació alemanya i la dissolució del bloc soviètic.'},
  {id:'fiurss',name:'Dissolució de la Unió Soviètica',year:1991,wiki:'https://ca.wikipedia.org/wiki/Dissoluci%C3%B3_de_la_Uni%C3%B3_Sovi%C3%A8tica',sitelinks:85,desc:'L’URSS s’acaba i la Guerra Freda amb ella. El món deixa de tenir dos centres.'},
  {id:'www',name:'Naixement de la World Wide Web',year:1991,wiki:'https://ca.wikipedia.org/wiki/World_Wide_Web',sitelinks:154,desc:'Tim Berners-Lee obre el primer web al públic. El canvi més gran en la difusió del saber des de la impremta.'},
  {id:'s11',name:'Atemptats de l’11 de setembre',year:2001,wiki:'https://ca.wikipedia.org/wiki/Atemptats_de_l%2711_de_setembre_de_2001',sitelinks:149,desc:'Dos avions tomben les torres de Nova York. Marca l’inici polític del segle XXI.'},
  {id:'covid',name:'Inici de la pandèmia de COVID-19',year:2020,wiki:'https://ca.wikipedia.org/wiki/Pand%C3%A8mia_de_COVID-19',sitelinks:170,desc:'Un coronavirus atura mig món durant mesos. El primer esdeveniment global viscut en directe per tothom.'},
  {id:'delt',name:'Fundació de DELT',year:2022,wiki:'https://deltproject.com/',sitelinks:0,imp:8,desc:'Projecte sense ànim de lucre que combina intel·ligència artificial i drons per ajudar organitzacions de conservació de fauna, sobretot la detecció i protecció de tortugues marines davant la caça furtiva.'}
];
// Importance metric is DERIVED from sitelinks/imp and never persisted. Compute it ONCE here at load
// (in RAM, as ev._m) instead of on every render — it only depends on the event's own static data.
// Change the formula in one place and every _m refreshes on the next page load; zero staleness risk.
const IMP_REF=Math.log(300);   // reference: ~300 Wikidata languages ≈ score 100
function metricOf(ev){return typeof ev.imp==='number'?ev.imp:((ev.sitelinks||0)>1?Math.round(100*Math.log(ev.sitelinks)/IMP_REF):0);}
EVENTS.forEach(ev=>{ev._m=metricOf(ev);});
// Stable label LAYOUT for the semantic zoom, precomputed ONCE here (zoom-independent), like _m above.

const PEOPLE=[
  {id:'socrates',wd:'Q913',name:'Sòcrates',birth:-470,death:-399,cats:['philosophy'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Sòcrates',desc:'Filòsof atenès que no deixà escrits propis, considerat el pare de la filosofia occidental i del mètode socràtic.'},
  {id:'plato',wd:'Q859',name:'Plató',birth:-428,death:-348,cats:['philosophy'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Plató',desc:'Filòsof atenès, deixeble de Sòcrates i fundador de l’Acadèmia, autor de La República.',approx:'aprox'},
  {id:'diogenes',wd:'Q59180',name:'Diògenes',birth:-412,death:-323,cats:['philosophy'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Diògenes_de_Sinope',desc:'Filòsof cínic grec, conegut per la seva vida austera i les seves crítiques mordaces a les convencions socials.'},
  {id:'aristotil',wd:'Q868',name:'Aristòtil',birth:-384,death:-322,cats:['philosophy','science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Aristòtil',desc:'Filòsof i científic grec, deixeble de Plató i tutor d’Alexandre Magne, sistematitzà gran part del saber antic.'},
  {id:'alexandre',wd:'Q8409',name:'Alexandre el Gran',birth:-356,death:-323,cats:['politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Alexandre_el_Gran',desc:'Rei de Macedònia, conquerí un dels imperis més vastos de l’antiguitat abans dels 33 anys.'},
  {id:'epicur',wd:'Q43216',name:'Epicur',birth:-341,death:-270,cats:['philosophy'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Epicur',desc:'Filòsof grec, fundador de l’epicureisme, defensor d’una vida senzilla orientada a la recerca del plaer moderat.'},
  {id:'cesar',wd:'Q1048',name:'Juli Cèsar',birth:-100,death:-44,cats:['politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Juli_Cèsar',desc:'General i dictador romà, la seva figura marca la transició de la República a l’Imperi Romà.'},
  {id:'cleopatra',wd:'Q635',name:'Cleopatra',birth:-69,death:-30,cats:['politics'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Cleòpatra',desc:'Última reina ptolemaica d’Egipte, coneguda per les seves aliances amb Juli Cèsar i Marc Antoni.'},
  {id:'jesucrist',wd:'Q302',name:'Jesucrist',birth:-4,death:30,cats:['religion'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Jesús_de_Natzaret',desc:'Predicador i mestre jueu del segle I, figura central del cristianisme i un dels personatges més influents de la civilització occidental.',approx:'aprox_disputada'},
  {id:'gengiskhan',wd:'Q720',name:'Gengis Khan',birth:1162,death:1227,cats:['politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Gengis_Khan',desc:'Fundador i primer gran khan de l’Imperi Mongol, el més extens de la història en superfície contínua.'},
  {id:'gutenberg',wd:'Q8958',name:'Johannes Gutenberg',birth:1400,death:1468,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Johannes_Gutenberg',desc:'Impressor alemany, inventor de la impremta de tipus mòbils, revolucionà la difusió del coneixement a Europa.'},
  {id:'joanadarc',wd:'Q7226',name:'Joana d’Arc',birth:1412,death:1431,cats:['politics'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Joana_d\u0027Arc',desc:'Pagesa francesa que liderà l’exèrcit reial durant la Guerra dels Cent Anys, cremada per heretgia i després canonitzada.'},
  {id:'davinci',wd:'Q762',name:'Leonardo da Vinci',birth:1452,death:1519,cats:['painting','science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Leonardo_da_Vinci',desc:'Pintor i polímata del Renaixement, autor de la Gioconda i precursor de la ciència i l’enginyeria modernes.'},
  {id:'copernic',wd:'Q619',name:'Nicolau Copèrnic',birth:1473,death:1543,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Nicolau_Copèrnic',desc:'Astrònom polonès, formulà el model heliocèntric que revolucionà la comprensió de l’univers.'},
  {id:'miquelangel',wd:'Q5592',name:'Miquel Àngel',birth:1475,death:1564,cats:['painting'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Miquel_Àngel',desc:'Escultor, pintor i arquitecte del Renaixement, autor del David i dels frescos de la Capella Sixtina.'},
  {id:'galileu',wd:'Q307',name:'Galileu Galilei',birth:1564,death:1642,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Galileu_Galilei',desc:'Astrònom i físic italià, defensà l’heliocentrisme i és considerat el pare del mètode científic modern.'},
  {id:'shakespeare',wd:'Q692',name:'William Shakespeare',birth:1564,death:1616,cats:['literature'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/William_Shakespeare',desc:'Dramaturg i poeta anglès, autor de Hamlet i Romeu i Julieta, el nom més universal de la literatura occidental.'},
  {id:'newton',wd:'Q935',name:'Isaac Newton',birth:1643,death:1727,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Isaac_Newton',desc:'Físic i matemàtic, formulà les lleis del moviment i la gravitació universal.'},
  {id:'bach',wd:'Q1339',name:'J.S. Bach',birth:1685,death:1750,cats:['music'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Johann_Sebastian_Bach',desc:'Compositor i organista del Barroc, referent de la música occidental.'},
  {id:'voltaire',wd:'Q9068',name:'Voltaire',birth:1694,death:1778,cats:['philosophy','literature'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Voltaire',desc:'Filòsof i escriptor il·lustrat, defensor de la llibertat d’expressió.'},
  {id:'franklin',wd:'Q34969',name:'Benjamin Franklin',birth:1706,death:1790,cats:['science','politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Benjamin_Franklin',desc:'Polímata, científic i un dels pares fundadors dels EUA.'},
  {id:'mozart',wd:'Q254',name:'Mozart',birth:1756,death:1791,cats:['music'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart',desc:'Compositor clàssic prolífic i influent tot i la seva vida breu.'},
  {id:'wollstonecraft',wd:'Q101638',name:'Mary Wollstonecraft',birth:1759,death:1797,cats:['philosophy','literature'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Mary_Wollstonecraft',desc:'Filòsofa i pionera del pensament feminista modern.'},
  {id:'napoleon',wd:'Q517',name:'Napoleó Bonaparte',birth:1769,death:1821,cats:['politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Napoleó_Bonaparte',desc:'Militar i emperador francès, dominà gran part d’Europa i deixà una petjada duradora en el dret i la política modernes.'},
  {id:'austen',wd:'Q36322',name:'Jane Austen',birth:1775,death:1817,cats:['literature'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Jane_Austen',desc:'Novel·lista anglesa, mestra de la ironia i la novel·la de costums.'},
  {id:'darwin',wd:'Q1035',name:'Charles Darwin',birth:1809,death:1882,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Charles_Darwin',desc:'Naturalista, formulà la teoria de l’evolució per selecció natural.'},
  {id:'lovelace',wd:'Q7259',name:'Ada Lovelace',birth:1815,death:1852,cats:['science'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Ada_Lovelace',desc:'Matemàtica, considerada la primera programadora de la història.'},
  {id:'marx',wd:'Q9061',name:'Karl Marx',birth:1818,death:1883,cats:['philosophy','politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Karl_Marx',desc:'Filòsof i economista, autor d’El Capital i pare del pensament comunista modern.'},
  {id:'vangogh',wd:'Q5582',name:'Vincent van Gogh',birth:1853,death:1890,cats:['painting'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Vincent_van_Gogh',desc:'Pintor postimpressionista holandès, autor de La nit estrellada, incomprès en vida i icona de l’art modern.'},
  {id:'curie',wd:'Q7186',name:'Marie Curie',birth:1867,death:1934,cats:['science'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Marie_Curie',desc:'Física i química, pionera de la radioactivitat i doble Nobel.'},
  {id:'gandhi',wd:'Q1001',name:'Mahatma Gandhi',birth:1869,death:1948,cats:['politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Mahatma_Gandhi',desc:'Líder independentista indi, promotor de la resistència no violenta i icona global de la lluita pacífica.'},
  {id:'einstein',wd:'Q937',name:'Albert Einstein',birth:1879,death:1955,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Albert_Einstein',desc:'Físic teòric, autor de la teoria de la relativitat.'},
  {id:'picasso',wd:'Q5593',name:'Pablo Picasso',birth:1881,death:1973,cats:['painting'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Pablo_Picasso',desc:'Pintor i escultor, cofundador del cubisme i l’artista més influent del segle XX.'},
  {id:'frida',wd:'Q5588',name:'Frida Kahlo',birth:1907,death:1954,cats:['painting'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Frida_Kahlo',desc:'Pintora mexicana, coneguda pels seus autoretrats i convertida en icona cultural global.'},
  {id:'mandela',wd:'Q8023',name:'Nelson Mandela',birth:1918,death:2013,cats:['politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Nelson_Mandela',desc:'Líder sud-africà, empresonat 27 anys per lluitar contra l’apartheid, president i símbol de reconciliació.'},
  {id:'bernat',wd:'',name:'Bernat B.',birth:1991,death:null,cats:[],gender:'',wiki:'',desc:'Neix el 1991.<br>Crea aquesta pàgina el 2026.<br>Encara no ha mort.'},
  {id:'lordbyron',wd:'Q5679',name:'Lord Byron',birth:1788,death:1824,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Lord_Byron',desc:'Poeta anglès'},
  {id:'rosaluxemburg',wd:'Q7231',name:'Rosa Luxemburg',birth:1871,death:1919,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Rosa_Luxemburg',desc:'Marxista revolucionària polonesa-alemanya'},
  {id:'confuci',wd:'Q4604',name:'Confuci',birth:-551,death:-479,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Confuci',desc:'Filòsof xinès'},
  {id:'patrickkluivert',wd:'Q189686',name:'Patrick Kluivert',birth:1976,death:null,cats:['sport'],wiki:'https://ca.wikipedia.org/wiki/Patrick_Kluivert',desc:'Futbolista neerlandès'},
  {id:'ansufati',wd:'Q66743376',name:'Ansu Fati',birth:2002,death:null,cats:['sport'],wiki:'https://ca.wikipedia.org/wiki/Ansu_Fati',desc:'Futbolista català'},
  {id:'madonna',wd:'Q1744',name:'Madonna',birth:1958,death:null,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Madonna',desc:'Cantant estatunidenca'},
  {id:'chetbaker',wd:'Q2274',name:'Chet Baker',birth:1929,death:1988,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Chet_Baker',desc:'Trompetista i cantant americà de jazz'},
  {id:'isaacasimov',wd:'Q34981',name:'Isaac Asimov',birth:1920,death:1992,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Isaac_Asimov',desc:'Escriptor estatunidenc'},
  {id:'martinscorsese',wd:'Q41148',name:'Martin Scorsese',birth:1942,death:null,cats:['cinema'],wiki:'https://ca.wikipedia.org/wiki/Martin_Scorsese',desc:'Director de cinema estatunidenc'},
  {id:'epictet',wd:'Q183144',name:'Epictet',birth:50,death:138,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Epictet',desc:'Filòsof grec'},
  {id:'tomasdaquino',wd:'Q9438',name:'Tomàs d’Aquino',birth:1225,death:1274,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Tom%C3%A0s_d%27Aquino',desc:'Frare i filòsof italià'},
  {id:'migueldecervantessaave',wd:'Q5682',name:'Miguel de Cervantes Saavedra',birth:1547,death:1616,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Miguel_de_Cervantes_Saavedra',desc:'Escriptor castellà'},
  {id:'ramonllull',wd:'Q193660',name:'Ramon Llull',birth:1232,death:1316,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Ramon_Llull',desc:'Escriptor i filòsof mallorquí'},
  {id:'caterinademedici',wd:'Q131552',name:'Caterina de Mèdici',birth:1519,death:1589,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Caterina_de_M%C3%A8dici',desc:'Reina consort de França de 1547 a 1559'},
  {id:'nero',wd:'Q1413',name:'Nero',birth:37,death:68,cats:['politics'],wiki:'https://en.wikipedia.org/wiki/Nero',desc:'Emperador romà del 54 al 68'},
  {id:'stephenhawking',wd:'Q17714',name:'Stephen Hawking',birth:1942,death:2018,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Stephen_Hawking',desc:'Físic teòric anglès'},
  {id:'ludwigvanbeethoven',wd:'Q255',name:'Ludwig van Beethoven',birth:1770,death:1827,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Ludwig_van_Beethoven',desc:'Compositor alemany'},
  {id:'giuseppeverdi',wd:'Q7317',name:'Giuseppe Verdi',birth:1813,death:1901,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Giuseppe_Verdi',desc:'Compositor italià'},
  {id:'ricardcordelleo',wd:'Q42305',name:'Ricard Cor de Lleó',birth:1157,death:1199,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Ricard_Cor_de_Lle%C3%B3',desc:'Rei d’Anglaterra de 1189 a 1199'},
  {id:'isabelidecastella',wd:'Q45859',name:'Isabel I de Castella',birth:1451,death:1504,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Isabel_I_de_Castella',desc:'Reina de Castella i Lleó de 1474 a 1504'},
  {id:'annefrank',wd:'Q4583',name:'Anne Frank',birth:1929,death:1945,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Anne_Frank',desc:'Diarista nascuda a Alemanya i víctima de l’Holocaust'},
  {id:'plutarcdequeronea',wd:'Q41523',name:'Plutarc de Queronea',birth:40,death:120,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Plutarc_de_Queronea',desc:'Historiador grec',approx:'aprox_disputada'},
  {id:'marcaureli',wd:'Q1430',name:'Marc Aureli',birth:121,death:180,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Marc_Aureli',desc:'Filòsof estoic, emperador romà del 161 al 180'},
  {id:'virginiawoolf',wd:'Q40909',name:'Virginia Woolf',birth:1882,death:1941,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Virginia_Woolf',desc:'Escriptora modernista anglesa'},
  {id:'franzkafka',wd:'Q905',name:'Franz Kafka',birth:1883,death:1924,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Franz_Kafka',desc:'Escriptor austríac i txec'},
  {id:'mahoma',wd:'Q9458',name:'Mahoma',birth:571,death:632,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Mahoma',desc:'Fundador de l’islam'},
  {id:'carlemany',wd:'Q3044',name:'Carlemany',birth:748,death:814,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Carlemany',desc:'Emperador carolingi del 800 al 814'},
  {id:'ramsesii',wd:'Q1523',name:'Ramsès II',birth:-1303,death:-1213,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Rams%C3%A8s_II',desc:'Tercer faraó de la dinastia XIX d’Egipte'},
  {id:'erasmederotterdam',wd:'Q43499',name:'Erasme de Rotterdam',birth:1466,death:1536,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Erasme_de_Rotterdam',desc:'Humanista i teòleg neerlandès',approx:'disputada'},
  {id:'paracels',wd:'Q83428',name:'Paracels',birth:1493,death:1541,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Paracels',desc:'Metge, filòsof, teòleg i alquimista suís'},
  {id:'atila',wd:'Q36724',name:'Àtila',birth:406,death:453,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/%C3%80tila',desc:'Governant de l’Imperi Hunnic del 434 al 453',approx:'aprox_disputada'},
  {id:'elcid',wd:'Q43958',name:'El Cid',birth:1048,death:1099,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/El_Cid',desc:'Cavaller castellà del segle XI'},
  {id:'moctezumaii',wd:'Q141791',name:'Moctezuma II',birth:1466,death:1520,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Moctezuma_II',desc:'Emperador de l’Imperi Asteca de 1502 o 1503 a 1520'},
  {id:'homer',wd:'Q6691',name:'Homer',birth:-750,death:-650,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Homer',desc:'Poeta de l’Antiga Grècia',approx:'aprox'},
  {id:'cristoforcolom',wd:'Q7322',name:'Cristòfor Colom',birth:1451,death:1506,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Crist%C3%B2for_Colom',desc:'Navegant i explorador genovès'},
  {id:'martiluter',wd:'Q9554',name:'Martí Luter',birth:1483,death:1546,cats:['religion'],wiki:'https://ca.wikipedia.org/wiki/Mart%C3%AD_Luter',desc:'Sacerdot, teòleg i escriptor alemany'},
  {id:'renedescartes',wd:'Q9191',name:'René Descartes',birth:1596,death:1650,cats:['philosophy','science'],wiki:'https://ca.wikipedia.org/wiki/Ren%C3%A9_Descartes',desc:'Polímata francès'},
  {id:'immanuelkant',wd:'Q9312',name:'Immanuel Kant',birth:1724,death:1804,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Immanuel_Kant',desc:'Filòsof prussià'},
  {id:'adamsmith',wd:'Q9381',name:'Adam Smith',birth:1723,death:1790,cats:['philosophy','politics'],wiki:'https://ca.wikipedia.org/wiki/Adam_Smith',desc:'Economista i filòsof escocès'},
  {id:'alexanderfleming',wd:'Q37064',name:'Alexander Fleming',birth:1881,death:1955,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Alexander_Fleming',desc:'Metge i microbiòleg escocès'},
  {id:'louispasteur',wd:'Q529',name:'Louis Pasteur',birth:1822,death:1895,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Louis_Pasteur',desc:'Microbiòleg i químic francès'},
  {id:'fiodordostoievski',wd:'Q991',name:'Fiódor Dostoievski',birth:1821,death:1881,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Fi%C3%B3dor_Dostoievski',desc:'Novel·lista rus'},
  {id:'friedrichwilhelmnietzs',wd:'Q9358',name:'Friedrich Wilhelm Nietzsche',birth:1844,death:1900,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Friedrich_Wilhelm_Nietzsche',desc:'Filòsof alemany'},
  {id:'sigmundfreud',wd:'Q9215',name:'Sigmund Freud',birth:1856,death:1939,cats:['science','philosophy'],wiki:'https://ca.wikipedia.org/wiki/Sigmund_Freud',desc:'Neuròleg austríac i fundador de la psicoanàlisi'},
  {id:'nikolatesla',wd:'Q9036',name:'Nikola Tesla',birth:1856,death:1943,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Nikola_Tesla',desc:'Enginyer i inventor serbo-estatunidenc'},
  {id:'winstonchurchill',wd:'Q8016',name:'Winston Churchill',birth:1874,death:1965,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Winston_Churchill',desc:'61è i 63è Primer ministre del Regne Unit'},
  {id:'adolfhitler',wd:'Q352',name:'Adolf Hitler',birth:1889,death:1945,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Adolf_Hitler',desc:'Dictador d’Alemanya de 1933 a 1945'},
  {id:'maozedong',wd:'Q5816',name:'Mao Zedong',birth:1893,death:1976,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Mao_Zedong',desc:'Líder de la Xina de 1949 a 1976'},
  {id:'alanturing',wd:'Q7251',name:'Alan Turing',birth:1912,death:1954,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Alan_Turing',desc:'Pioner de la informàtica anglès'},
  {id:'simonedebeauvoir',wd:'Q7197',name:'Simone de Beauvoir',birth:1908,death:1986,cats:['philosophy','literature'],wiki:'https://ca.wikipedia.org/wiki/Simone_de_Beauvoir',desc:'Filòsofa, teòrica social i activista francesa'},
  {id:'charleschaplin',wd:'Q882',name:'Charles Chaplin',birth:1889,death:1977,cats:['cinema'],wiki:'https://ca.wikipedia.org/wiki/Charles_Chaplin',desc:'Actor i cineasta anglès'},
  {id:'safo',wd:'Q17892',name:'Safo de Lesbos',birth:-630,death:-570,cats:['literature'],gender:'F',wiki:'https://ca.wikipedia.org/wiki/Safo_de_Lesbos',desc:'Poeta grega de l’illa de Lesbos, la veu lírica més admirada de l’antiguitat; només se’n conserven fragments.',approx:'aprox_disputada'},
  {id:'laozi',wd:'Q9333',name:'Laozi',birth:-604,death:-531,cats:['philosophy'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Laozi',desc:'Pensador xinès a qui s’atribueix el Dao De Jing i la fundació del taoisme; potser un personatge compost.',approx:'aprox_disputada'},
  {id:'seneca',wd:'Q2054',name:'Sèneca',birth:-4,death:65,cats:['philosophy','literature'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Luci_Anneu_S%C3%A8neca',desc:'Filòsof estoic i tutor de Neró, que acabà ordenant-li el suïcidi; les seves cartes són el manual estoic més llegit.',approx:'aprox'},
  {id:'buda',wd:'Q9441',name:'Buda',birth:-563,death:-483,cats:['religion'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Buda_Gautama',desc:'Príncep de Kapilavastu que renuncià a la seva posició i fundà el budisme; les seves dates són tradicionals i discutides.',approx:'aprox_disputada'},
  {id:'mahavira',wd:'Q9422',name:'Mahavira',birth:-599,death:-527,cats:['religion'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Mahavira',desc:'Mestre jainista, l’últim dels vint-i-quatre tirthankares; contemporani del Buda i del Confuci.',approx:'disputada'},
  {id:'johancruyff',wd:'Q17163',name:'Johan Cruyff',birth:1947,death:2016,cats:['sport'],wiki:'https://ca.wikipedia.org/wiki/Johan_Cruyff',desc:'Jugador i entrenador de futbol neerlandès'},
  {id:'charlesdickens',wd:'Q5686',name:'Charles Dickens',birth:1812,death:1870,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Charles_Dickens',desc:'Escriptor anglès'},
  {id:'edwardsmith',wd:'Q215786',name:'Edward Smith',birth:1850,death:1912,cats:[],wiki:'https://es.wikipedia.org/wiki/Edward_Smith',desc:'Capità del Titanic'},
  {id:'franciscodegoyaylucien',wd:'Q5432',name:'Francisco de Goya y Lucientes',birth:1746,death:1828,cats:['painting'],wiki:'https://ca.wikipedia.org/wiki/Francisco_de_Goya_y_Lucientes',desc:'Pintor i gravador aragonés'},
  {id:'luisdeleon',wd:'Q450246',name:'Luis de León',birth:1527,death:1591,cats:['literature'],wiki:'https://ca.wikipedia.org/wiki/Luis_de_Le%C3%B3n',desc:'Poeta espanyol'},
  {id:'diegoarmandomaradona',wd:'Q17515',name:'Diego Armando Maradona',birth:1960,death:2020,cats:['sport'],wiki:'https://ca.wikipedia.org/wiki/Diego_Armando_Maradona',desc:'Futbolista argentí'},
  {id:'antonigaudiicornet',wd:'Q25328',name:'Antoni Gaudí i Cornet',birth:1852,death:1926,cats:[],wiki:'https://ca.wikipedia.org/wiki/Antoni_Gaud%C3%AD_i_Cornet',desc:'Arquitecte català'},
  {id:'paulcezanne',wd:'Q35548',name:'Paul Cézanne',birth:1839,death:1906,cats:['painting'],wiki:'https://ca.wikipedia.org/wiki/Paul_C%C3%A9zanne',desc:'Pintor francès'},
  {id:'antoniovivaldi',wd:'Q1340',name:'Antonio Vivaldi',birth:1678,death:1741,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Antonio_Vivaldi',desc:'Compositor i violinista italià'},
  {id:'henrimatisse',wd:'Q5589',name:'Henri Matisse',birth:1869,death:1954,cats:['painting'],wiki:'https://ca.wikipedia.org/wiki/Henri_Matisse',desc:'Artista francès'},
  {id:'marcopolo',wd:'Q6101',name:'Marco Polo',birth:1254,death:1324,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Marco_Polo',desc:'Mercader i explorador venecià'},
  {id:'friedrichengels',wd:'Q34787',name:'Friedrich Engels',birth:1820,death:1895,cats:['philosophy'],wiki:'https://ca.wikipedia.org/wiki/Friedrich_Engels',desc:'Filòsof i socialista alemany'},
  {id:'robertcharlton',wd:'Q171583',name:'Robert (Bobby) Charlton',birth:1937,death:2023,cats:['sport'],wiki:'https://ca.wikipedia.org/wiki/Robert_Charlton',desc:'Futbolista anglès'},
  {id:'lluisxvidefranca',wd:'Q7732',name:'Lluís XVI de França',birth:1754,death:1793,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Llu%C3%ADs_XVI_de_Fran%C3%A7a',desc:'Rei de França de 1774 a 1792'},
  {id:'abrahamlincoln',wd:'Q91',name:'Abraham Lincoln',birth:1809,death:1865,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Abraham_Lincoln',desc:'16è president dels Estats Units d’Amèrica'},
  {id:'georgewashington',wd:'Q23',name:'George Washington',birth:1732,death:1799,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/George_Washington',desc:'1r President dels Estats Units'},
  {id:'mariaantonietadaustria',wd:'Q47365',name:'Maria Antonieta d’Àustria',birth:1755,death:1793,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Maria_Antonieta_d%27%C3%80ustria',desc:'Reina consort de França de 1774 a 1792'},
  {id:'gilbertogil',wd:'Q221479',name:'Gilberto Gil',birth:1942,death:null,cats:['music'],wiki:'https://es.wikipedia.org/wiki/Gilberto_Gil',desc:'Cantant, Brasil'},
  {id:'juanluisguerra',wd:'Q158753',name:'Juan Luis Guerra',birth:1957,death:null,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Juan_Luis_Guerra',desc:'Cantautor i productor musical dominicà'},
  {id:'rubenblades',wd:'Q474980',name:'Rubén Blades',birth:1948,death:null,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Rub%C3%A9n_Blades',desc:'Cantant i actor panameny'},
  {id:'danielrabinovich',wd:'Q8353654',name:'Daniel Rabinovich',birth:1943,death:2015,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/Daniel_Rabinovich',desc:'Actor, músic, i humorista argentí'},
  {id:'nefertiti',wd:'Q40930',name:'Nefertiti',birth:-1370,death:-1330,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Nefertiti',desc:'Gran esposa reial d’Akhenaton i reina d’Egipte'},
  {id:'hatxepsut',wd:'Q129234',name:'Hatxepsut',birth:-1507,death:-1458,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Hatxepsut',desc:'Faraona d’Egipte del 1479 al 1458 aC',approx:'disputada'},
  {id:'felipeiideespana',wd:'Q34417',name:'Felipe II de España',birth:1527,death:1598,cats:['politics'],wiki:'https://es.wikipedia.org/wiki/Felipe_II_de_Espa%C3%B1a',desc:'Rei d’Espanya de 1556 a 1598'},
  {id:'muhammadibnmussaalkhwa',wd:'Q9038',name:'Muhàmmad ibn Mussa al-Khwarazmí',birth:780,death:850,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Muh%C3%A0mmad_ibn_Mussa_al-Khwarazm%C3%AD',desc:'Matemàtic i astrònom persa; dels seus llibres venen les paraules «algorisme» i «àlgebra».',approx:'disputada'},
  {id:'ciril',wd:'Q351026',name:'Ciril',birth:827,death:869,cats:['religion','literature'],gender:'M',desc:'Missioner bizantí als pobles eslaus; amb el seu germà Metodi va crear el primer alfabet eslau.'},
  {id:'carleselcalb',wd:'Q71231',name:'Carles el Calb',birth:823,death:877,cats:['politics'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Carles_el_Calb',desc:'Rei de Frància Occidental de 843 a 877 i emperador carolingi de 875 a 877'},
  {id:'abbasibnfirnas',wd:'Q305975',name:'Abbàs ibn Firnàs',birth:810,death:887,cats:['science'],gender:'M',wiki:'https://ca.wikipedia.org/wiki/Abb%C3%A0s_ibn_Firn%C3%A0s',desc:'Erudit andalusí de Còrdova; va provar de volar amb unes ales i va sobreviure a l’intent.'},
  {id:'johanneskepler',wd:'Q8963',name:'Johannes Kepler',birth:1571,death:1630,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Johannes_Kepler',desc:'Astrònom i matemàtic alemany'},
  {id:'pelaidasturies',wd:'Q14655',name:'Pelai d’Astúries',birth:685,death:737,cats:[],wiki:'https://ca.wikipedia.org/wiki/Pelai_d%27Ast%C3%BAries',desc:'Primer rei d’Astúries',approx:'disputada'},
  {id:'ignazsemmelweis',wd:'Q59736',name:'Ignaz Semmelweis',birth:1818,death:1865,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Ignaz_Semmelweis'},
  {id:'johnlennon',wd:'Q1203',name:'John Lennon',birth:1940,death:1980,cats:['music'],wiki:'https://ca.wikipedia.org/wiki/John_Lennon',desc:'Músic i activista anglès'},
  {id:'neilarmstrong',wd:'Q1615',name:'Neil Armstrong',birth:1930,death:2012,cats:['science'],wiki:'https://ca.wikipedia.org/wiki/Neil_Armstrong',desc:'Astronauta estatunidenc'},
  {id:'vassilikandinski',wd:'Q61064',name:'Vassili Kandinski',birth:1866,death:1944,cats:['painting'],wiki:'https://ca.wikipedia.org/wiki/Vassili_Kandinski',desc:'Pintor rus i teòric de l’art'},
  {id:'elisabetiidelregneunit',wd:'Q9682',name:'Elisabet II del Regne Unit',birth:1926,death:2022,cats:['politics'],wiki:'https://ca.wikipedia.org/wiki/Elisabet_II_del_Regne_Unit',desc:'Reina del Regne Unit i altres reialmes de la Commonwealth de 1952 a 2022'},
  {id:'howardcarter',wd:'Q133682',name:'Howard Carter',birth:1874,death:1939,cats:['painting'],wiki:'https://ca.wikipedia.org/wiki/Howard_Carter',desc:'Arqueòleg i Egiptòleg anglès'},
];

// Els jocs només necessiten PEOPLE i EVENTS, i els llegeixen com a window.HB_DATA.
// Es manté el nom perquè joc.html ja hi parlava així quan això era data.js.
window.HB_DATA={PEOPLE,EVENTS};
