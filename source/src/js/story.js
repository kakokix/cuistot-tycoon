// ===================== STORY: season 1, regulars' stories, dialogue player, journal =====================
var Story = (function () {
  var NB = ' ';
  function fr(t) { return t.replace(/ ([!?:;»])/g, NB + '$1').replace(/« /g, '«' + NB); }
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------------- cast ----------------
  function cu(id) { return function (m) { return 'cu_' + id + '_' + (m === 'happy' || m === 'worried' || m === 'angry' ? m : 'neutral'); }; }
  var CAST = {
    marcel: { name: 'Chef Marcel', side: 'L', big: true, spr: function (m) { return 'chef_' + (m === 'worried' ? 'worried' : m === 'focus' ? 'focus' : 'happy'); } },
    theo:   { name: 'Théo', side: 'L', big: true, spr: function (m) { return m === 'focus' ? 'commis_focus' : 'commis_happy'; } },
    papi:   { name: 'Papi Malo', side: 'R', spr: cu('papi') },
    hugo:   { name: 'Hugo', side: 'R', spr: cu('explorateur') },
    mamie:  { name: 'Mamie Lila', side: 'R', spr: cu('mamie') },
    leo:    { name: 'Léo', side: 'R', spr: cu('garcon') },
    awa:    { name: 'Awa', side: 'R', spr: cu('touriste') },
    tanaka: { name: 'M. Tanaka', side: 'R', spr: cu('affaires') },
    zuri:   { name: 'Zuri', side: 'R', spr: cu('photographe') },
    kai:    { name: 'Kai', side: 'R', spr: cu('surfeur') },
    benali: { name: 'Mme Benali', side: 'R', spr: cu('critique') },
    capitaine: { name: 'Capitaine Moana', side: 'R', spr: cu('capitaine') },
    nina: { name: 'Nina', side: 'R', spr: cu('nina') },
    guide: { name: 'Élise', side: 'R', spr: cu('guide') },
    rival: { name: 'Chef Gaston', side: 'R', spr: cu('rival') }
  };
  // customer sprite id -> cast id
  var WHO = { papi: 'papi', explorateur: 'hugo', mamie: 'mamie', garcon: 'leo', touriste: 'awa', affaires: 'tanaka', photographe: 'zuri', surfeur: 'kai', critique: 'benali' };
  var BIO = {
    papi: 'Le doyen du village. Il connaît toutes les légendes de la jungle… et toutes les recettes de soupe.',
    explorateur: 'Explorateur intrépide, à la recherche du mythique Temple du Goût.',
    mamie: 'Ancienne reine de la friterie du port. Ses conseils valent de l’or.',
    garcon: 'Le petit-fils de Mamie Lila. Il rêve de devenir un grand chef.',
    touriste: 'Voyageuse et blogueuse : elle raconte ses aventures à des milliers d’abonnés.',
    affaires: 'Promoteur toujours pressé… qui cache peut-être un cœur tendre.',
    photographe: 'Photographe pour Jungle Magazine. Elle voit la beauté dans les détails.',
    surfeur: 'Surfeur et pêcheur. Il apporte le poisson frais chaque matin.',
    critique: 'La critique gastronomique la plus redoutée du pays. Quand elle vient, elle paie le double !',
    capitaine: 'Capitaine de la Perle Bleue. Elle apporte le poisson frais à tous les ports de l’île.',
    nina: 'Reine du food truck de la plage. Ses frites se coupent au rythme de la samba.',
    guide: 'Guide de montagne. Elle connaît chaque sentier et chaque herbe sauvage.',
    rival: 'L’ancien patron parisien de Marcel. Brillant, orgueilleux… et très seul.'
  };
  var ORDER = ['papi', 'explorateur', 'mamie', 'garcon', 'touriste', 'affaires', 'photographe', 'surfeur', 'critique', 'capitaine', 'nina', 'guide', 'rival'];

  // ---------------- season 1 (chapter unlocked once its day is won) ----------------
  var CHAPTERS = [
    { id: 'prologue', day: 0, title: 'Un nouveau départ', lines: [
      ['', '', 'Paris. Depuis vingt ans, Chef Marcel cuisine dans un grand restaurant… toujours pressé, toujours stressé.'],
      ['marcel', 'worried', 'Des commandes, encore des commandes… Je suis épuisé. J’ai oublié pourquoi j’aimais cuisiner.'],
      ['', '', 'Un matin, une lettre arrive : sa vieille tante lui laisse une petite cabane, au bord de la jungle.'],
      ['papi', 'happy', 'Bienvenue, Chef ! Je suis Papi Malo, le doyen du village. Ta tante était mon amie. Voici les clés !'],
      ['marcel', 'focus', 'Un grill, un bar à jus, un comptoir… C’est tout petit !'],
      ['papi', 'neutral', 'Ici, on ne court pas. On cuisine avec le cœur, et on prend le temps.'],
      ['marcel', 'happy', 'Prendre le temps… Ça me plaît ! C’est décidé : j’ouvre « Chez Cuistot » !']] },
    { id: 'c1', day: 1, title: 'Le premier client', lines: [
      ['hugo', 'happy', 'Quel burger ! Ça faisait trois semaines que je mangeais des conserves dans la jungle.'],
      ['marcel', 'happy', 'Trois semaines ? Mais que cherchez-vous là-dedans ?'],
      ['hugo', 'neutral', 'Je m’appelle Hugo, explorateur. Je cherche le Temple du Goût : la légende dit qu’il cache le plus vieux livre de recettes du monde.'],
      ['marcel', 'focus', 'Un livre de recettes perdu… Voilà une histoire qui me plaît !'],
      ['hugo', 'happy', 'Je reviendrai, Chef. Un explorateur a besoin d’un bon QG… et d’un bon burger !']] },
    { id: 'c2', day: 2, title: 'Les conseils de Mamie Lila', lines: [
      ['mamie', 'neutral', 'Hum… Ton burger est bon, mon garçon. Mais il lui manque un ami.'],
      ['marcel', 'worried', 'Un ami ?'],
      ['mamie', 'happy', 'Des frites, voyons ! J’ai tenu une friterie pendant quarante ans. Le secret : deux cuissons et beaucoup d’amour.'],
      ['leo', 'happy', 'Mamie fait les meilleures frites du monde ! Moi, c’est Léo. Un jour, je serai chef, comme vous !'],
      ['marcel', 'happy', 'Alors marché conclu, Léo : toi, tu goûtes, et moi, je cuisine !'],
      ['', '', 'Astuce : achète la Friteuse dans la Boutique pour ajouter les frites au menu.']] },
    { id: 'c3', day: 3, title: 'Une photo qui voyage', lines: [
      ['awa', 'happy', 'Pardon ! Je peux prendre votre jus en photo ? Il est trop beau !'],
      ['marcel', 'focus', 'Euh… bien sûr ?'],
      ['awa', 'happy', 'Je m’appelle Awa. Je fais le tour du monde et je raconte mes voyages en ligne. Des milliers de gens me suivent !'],
      ['', '', 'Le soir même, la photo du jus tropical fait le tour d’Internet.'],
      ['marcel', 'worried', 'Pourquoi y a-t-il autant de monde devant la porte ce matin ?'],
      ['awa', 'happy', 'Bienvenue dans la célébrité, Chef !']] },
    { id: 'c4', day: 5, title: 'L’homme au costume', lines: [
      ['tanaka', 'neutral', 'Joli petit endroit. Dommage qu’il soit sur MON futur terrain.'],
      ['marcel', 'worried', 'Votre terrain ?'],
      ['tanaka', 'neutral', 'Kenji Tanaka, promoteur. Je vais construire ici le plus grand hôtel de la côte. Papi Malo n’a qu’à me vendre ce terrain.'],
      ['papi', 'angry', 'Jamais ! Cette terre appartient à la jungle et au village.'],
      ['tanaka', 'angry', 'Nous verrons bien. Un petit resto inconnu ne pèsera pas lourd face à mon projet.'],
      ['marcel', 'focus', 'Alors il ne restera pas inconnu longtemps. Je vous le promets.']] },
    { id: 'c5', day: 7, title: 'Le rêve de Léo', lines: [
      ['leo', 'worried', 'Chef… Les autres enfants disent que je suis trop petit pour cuisiner.'],
      ['marcel', 'happy', 'Trop petit ? Moi, à ton âge, je faisais tomber tous les œufs par terre !'],
      ['leo', 'happy', 'C’est vrai ?'],
      ['marcel', 'happy', 'Vrai de vrai. Viens, je vais te montrer comment étaler une pâte à pizza. Le secret, c’est la patience.'],
      ['mamie', 'happy', 'Regarde-le, il a des étoiles plein les yeux… Merci, Marcel.'],
      ['', '', 'Ce jour-là, Léo a fait sa première pizza. Elle était toute tordue. Elle était parfaite.']] },
    { id: 'c6', day: 9, title: 'La carte au trésor', lines: [
      ['hugo', 'happy', 'Chef ! Regarde ce que j’ai trouvé dans une grotte !'],
      ['marcel', 'focus', 'Un vieux morceau de carte… Il y a des dessins de légumes et une marmite !'],
      ['hugo', 'neutral', 'C’est la moitié de la carte du Temple du Goût. Mais où est l’autre moitié ?'],
      ['papi', 'worried', 'Mon grand-père me parlait d’une carte coupée en deux… Je crois qu’il en gardait un morceau.'],
      ['hugo', 'happy', 'Papi Malo, vous êtes plein de surprises !'],
      ['papi', 'neutral', 'Laisse-moi fouiller mon grenier. Patience…']] },
    { id: 'c7', day: 11, title: 'Le regard de Zuri', lines: [
      ['zuri', 'neutral', 'Bonjour. Je suis Zuri, photographe animalière pour Jungle Magazine.'],
      ['marcel', 'happy', 'Bienvenue ! Vous photographiez les singes du coin ?'],
      ['zuri', 'happy', 'Les toucans, surtout. Mais votre restaurant me plaît : ici, les gens ont l’air… heureux.'],
      ['zuri', 'neutral', 'Je cherche une histoire pour la couverture du mois prochain. Et si c’était la vôtre ?'],
      ['marcel', 'worried', 'La couverture ? Moi ?'],
      ['zuri', 'happy', 'Continuez comme ça, et je reviens avec mon appareil photo !']] },
    { id: 'c8', day: 13, title: 'Kai et la mer', lines: [
      ['kai', 'happy', 'Salut, Chef ! J’ai pêché un saumon énorme ce matin. Trop gros pour moi tout seul !'],
      ['marcel', 'focus', 'Un saumon si frais… On pourrait en faire des sushis !'],
      ['kai', 'happy', 'Carrément ! Je t’en apporte tous les matins, si tu me gardes une part de gâteau.'],
      ['marcel', 'happy', 'Marché conclu, Kai !'],
      ['kai', 'worried', 'Au fait, j’ai vu un drôle de monsieur en costume mesurer la plage avec un ruban…'],
      ['marcel', 'worried', 'Tanaka… Il ne lâche rien.']] },
    { id: 'c9', day: 15, title: 'Le Temple du Goût', reward: 'livre', lines: [
      ['papi', 'happy', 'Je l’ai trouvé ! Le morceau de carte de mon grand-père, caché dans une vieille boîte à épices !'],
      ['hugo', 'happy', 'Les deux moitiés s’assemblent parfaitement ! Le Temple est… derrière la grande cascade !'],
      ['marcel', 'focus', 'Alors, en route ! Léo, Mamie, Kai, Awa… Tout le monde dans l’aventure !'],
      ['', '', 'Après une longue marche, la petite troupe découvre un temple couvert de lianes.'],
      ['', '', 'Au centre, sur un autel de pierre, repose un énorme livre doré : le Grand Livre des Saveurs.'],
      ['mamie', 'happy', 'Des recettes de toutes les cuisines du monde… écrites il y a mille ans !'],
      ['hugo', 'happy', 'Ma quête est terminée. Ce livre doit vivre dans une cuisine, pas dans un musée. Il est à toi, Chef.']] },
    { id: 'c10', day: 18, title: 'Le cœur de M. Tanaka', lines: [
      ['tanaka', 'angry', 'Encore ouvert ? Mon hôtel devrait déjà être construit !'],
      ['marcel', 'happy', 'Asseyez-vous, M. Tanaka. Goûtez ce gâteau, il sort du four.'],
      ['tanaka', 'neutral', 'Je n’ai pas le temps pour… Bon. Une bouchée.'],
      ['tanaka', 'happy', 'C’est… le gâteau aux fraises que faisait ma mère. Je l’avais oublié.'],
      ['marcel', 'happy', 'Ici, on prend le temps. Même les hommes d’affaires.'],
      ['tanaka', 'worried', 'Peut-être… que je me suis trompé sur cet endroit.']] },
    { id: 'c11', day: 21, title: 'La critique arrive', lines: [
      ['zuri', 'happy', 'Chef, tu te souviens de la dame élégante qui vient parfois et qui paie toujours le double ?'],
      ['marcel', 'focus', 'Celle qui note tout dans un petit carnet ? Oui…'],
      ['zuri', 'happy', 'C’est Mme Benali, LA critique gastronomique ! Elle venait incognito. Ce soir, elle vient écrire son article !'],
      ['marcel', 'worried', 'Celle qui fait trembler les plus grands chefs ? Oh là là…'],
      ['awa', 'happy', 'Pas de panique ! Tu cuisines avec le cœur, c’est tout ce qui compte.'],
      ['theo', 'happy', 'Et tu n’es pas seul, Chef. On est une équipe !'],
      ['marcel', 'happy', 'Vous avez raison. On va lui servir ce qu’on fait de mieux : du bonheur dans une assiette.']] },
    { id: 'c12', day: 24, title: 'Le verdict', reward: 'finale', lines: [
      ['benali', 'neutral', '…'],
      ['benali', 'happy', 'En trente ans de métier, je n’ai jamais mangé avec autant de plaisir. Ce restaurant a une âme.'],
      ['benali', 'neutral', 'Je lui donne la note maximale : trois toques d’or. Demain, tout le pays connaîtra « Chez Cuistot ».'],
      ['tanaka', 'happy', 'Chef Marcel… J’abandonne mon projet d’hôtel. Ce terrain doit rester tel qu’il est.'],
      ['tanaka', 'neutral', 'Mais j’ai une autre idée : et si je t’aidais à ouvrir des restaurants « Chez Cuistot » ailleurs ?'],
      ['papi', 'happy', 'La jungle est sauvée ! Ta tante serait si fière de toi, Marcel.'],
      ['marcel', 'happy', 'Merci à tous. Ici, j’ai retrouvé ce que j’avais perdu à Paris : le plaisir de cuisiner.'],
      ['', '', 'Fin de la Saison 1. Le restaurant reste ouvert : de nouveaux jours et de nouvelles histoires t’attendent !']] }
  ];
  var CH_BY_ID = {}; CHAPTERS.forEach(function (c, i) { c.n = i; c.s = 1; CH_BY_ID[c.id] = c; });
  // ---------------- season 2: the island tour (unlocked by days, like season 1) ----------------
  var CHAPTERS2 = [
    { id: 's2c0', day: 24, s: 2, title: 'Une nouvelle aventure', unlockLoc: 'plage', lines: [
      ['tanaka', 'happy', 'Chef Marcel ! J’ai une proposition. Mon ancien bureau au bord de la plage est vide…'],
      ['tanaka', 'neutral', 'Et si on en faisait un deuxième « Chez Cuistot » ? Tu choisis la carte, je m’occupe des travaux.'],
      ['marcel', 'worried', 'Un deuxième restaurant ? Mais qui va s’occuper de celui de la jungle ?'],
      ['theo', 'happy', 'Moi, Chef ! Tu m’as tout appris. Et Léo m’aidera après l’école.'],
      ['papi', 'happy', 'Va, Marcel. Fais découvrir ta cuisine à toute l’île. La jungle sera toujours ta maison.'],
      ['', '', 'Nouveau lieu débloqué : la Plage ! Ouvre la Carte depuis la cuisine pour t’y rendre.']] },
    { id: 's2c1', day: 25, s: 2, title: 'La capitaine Moana', lines: [
      ['capitaine', 'neutral', 'Ahoy ! Capitaine Moana. Mon bateau, la Perle Bleue, apporte le poisson frais à tous les ports de l’île.'],
      ['marcel', 'happy', 'Du poisson frais chaque jour ? C’est parfait pour les sushis de la plage !'],
      ['capitaine', 'happy', 'J’en garde toujours un peu pour les amis. Et ceux qui cuisinent bien deviennent vite mes amis.'],
      ['kai', 'happy', 'Moana m’a appris à pêcher quand j’étais petit. C’est la meilleure marin des sept mers !'],
      ['capitaine', 'worried', 'Ne l’écoute pas, Chef. Je me suis déjà perdue… une fois. Dans un port. En plein brouillard.']] },
    { id: 's2c2', day: 26, s: 2, title: 'L’ombre de Paris', lines: [
      ['awa', 'worried', 'Chef, regarde cette affiche… « Bientôt : Le Grand Gaston, la cuisine de luxe arrive sur l’île ».'],
      ['marcel', 'worried', 'Gaston… C’était mon patron à Paris. Celui qui criait sur tout le monde en cuisine.'],
      ['awa', 'neutral', 'Il a l’air très sûr de lui. Il dit qu’il va « remettre de l’ordre » dans la cuisine de l’île.'],
      ['marcel', 'focus', 'Il pense que la cuisine, c’est une guerre. Moi, je sais que c’est un partage.'],
      ['awa', 'happy', 'Alors montre-le-lui. Et moi, je raconterai tout à mes abonnés !']] },
    { id: 's2c3', day: 28, s: 2, title: 'Nina et son camion', lines: [
      ['nina', 'happy', 'Bom dia ! Je suis Nina. Mon food truck, c’est le roi des frites de toute la plage !'],
      ['marcel', 'happy', 'Le roi des frites ? Mamie Lila risque d’être jalouse…'],
      ['nina', 'worried', 'Le problème, c’est qu’un monsieur en veste noire veut racheter tous les petits commerces de la plage.'],
      ['nina', 'angry', 'Il m’a dit que mon camion « faisait désordre ». Désordre ! Mon camion est magnifique !'],
      ['marcel', 'focus', 'Gaston… Ne t’en fais pas, Nina. On va trouver une solution ensemble.'],
      ['nina', 'happy', 'J’aime bien ce chef. Il a une moustache sympathique.']] },
    { id: 's2c4', day: 30, s: 2, title: 'Le chalet de la montagne', unlockLoc: 'montagne', lines: [
      ['', '', 'Une lettre arrive, écrite d’une main tremblante : « Mon chalet tombe en ruine. Il a besoin d’un chef. Signé : la grand-mère d’Élise. »'],
      ['marcel', 'focus', 'Un chalet perdu dans la neige… Il y fait sûrement très froid.'],
      ['mamie', 'happy', 'Le froid, ça donne faim ! Prends ma recette de soupe, elle réchauffe les cœurs et les orteils.'],
      ['theo', 'happy', 'Et un bon gâteau au coin du feu… Chef, il faut y aller !'],
      ['', '', 'Nouveau lieu débloqué : la Montagne ! Ouvre la Carte pour t’y rendre.']] },
    { id: 's2c5', day: 32, s: 2, title: 'Élise, la guide', lines: [
      ['guide', 'happy', 'Bienvenue au chalet ! Je suis Élise, guide de montagne. Ma grand-mère a tenu ce chalet pendant cinquante ans.'],
      ['marcel', 'happy', 'Il a beaucoup de charme. Un peu de peinture, et il sera comme neuf.'],
      ['guide', 'worried', 'Grand-mère est trop fatiguée maintenant. Et un certain Gaston veut le transformer en hôtel de luxe…'],
      ['marcel', 'worried', 'Encore lui !'],
      ['guide', 'happy', 'Mais si le chalet redevient vivant, plein de randonneurs heureux, personne ne pourra le lui vendre !']] },
    { id: 's2c6', day: 33, s: 2, title: 'La tempête de neige', lines: [
      ['', '', 'Une nuit, une terrible tempête de neige bloque toutes les routes. Des randonneurs se réfugient au chalet.'],
      ['guide', 'worried', 'Ils sont gelés et affamés ! Et le camion de livraison ne pourra pas monter avant trois jours…'],
      ['marcel', 'focus', 'Pas de panique. Il nous reste des pommes de terre, des légumes et de la farine. On va cuisiner avec ce qu’on a.'],
      ['', '', 'Toute la nuit, Marcel et Élise préparent des soupes fumantes et des petits gâteaux pour tout le monde.'],
      ['guide', 'happy', 'Regarde-les, Chef. Ils chantent ! La tempête est devenue une fête.'],
      ['marcel', 'happy', 'La cuisine, c’est ça : transformer un moment difficile en joli souvenir.']] },
    { id: 's2c7', day: 34, s: 2, title: 'Le secret de Gaston', lines: [
      ['zuri', 'neutral', 'Chef, j’ai fait une petite enquête sur Gaston pour mon magazine. Tu veux savoir ce que j’ai découvert ?'],
      ['marcel', 'focus', 'Il est encore plus riche que je le pensais ?'],
      ['zuri', 'worried', 'Non… Son restaurant de Paris est presque vide. Ses cuisiniers sont tous partis. Personne ne voulait travailler avec lui.'],
      ['marcel', 'worried', 'Alors il vient ici parce qu’il a tout perdu…'],
      ['zuri', 'neutral', 'Peut-être qu’il ne sait pas faire autrement. Il n’a jamais appris à cuisiner avec le cœur.']] },
    { id: 's2c8', day: 36, s: 2, title: 'Le défi', unlockLoc: 'ville', lines: [
      ['rival', 'neutral', 'Tiens, tiens… Le petit Marcel. Toujours à jouer au cuisinier dans ta cabane ?'],
      ['marcel', 'neutral', 'Bonjour, Gaston. Bienvenue sur l’île.'],
      ['rival', 'angry', 'Je vais ouvrir le plus grand restaurant de la ville, sur le toit de la tour. Et toi, tu vas fermer boutique.'],
      ['tanaka', 'neutral', 'Pas si vite. Le toit de la tour voisine m’appartient. Et j’y ouvre… un « Chez Cuistot » !'],
      ['rival', 'angry', 'Très bien ! Alors réglons ça en cuisine : un grand concours devant toute l’île. Le perdant quitte la ville !'],
      ['', '', 'Nouveau lieu débloqué : la Ville ! Ouvre la Carte pour t’y rendre.']] },
    { id: 's2c9', day: 38, s: 2, title: 'Le Rooftop', lines: [
      ['awa', 'happy', 'Ce rooftop est incroyable ! On voit toute la ville d’ici. Mes abonnés vont adorer.'],
      ['theo', 'focus', 'Chef, la cuisine est minuscule, mais j’ai tout rangé comme tu aimes.'],
      ['rival', 'neutral', 'Joli. Mais un joli restaurant ne fait pas un grand chef. Rendez-vous au concours, Marcel.'],
      ['marcel', 'happy', 'J’y serai, Gaston. Et tu es invité à goûter ma cuisine quand tu veux.'],
      ['rival', 'worried', '…Goûter ? Personne ne m’invite jamais à goûter.']] },
    { id: 's2c10', day: 40, s: 2, title: 'La veille du concours', lines: [
      ['', '', 'La veille du concours, tous les amis de Marcel arrivent en ville : de la jungle, de la plage et de la montagne.'],
      ['papi', 'happy', 'Nous voilà, Marcel ! Toute la famille est là pour te soutenir.'],
      ['capitaine', 'happy', 'J’ai apporté le plus beau poisson de l’océan.'],
      ['guide', 'happy', 'Et moi, les meilleures herbes de la montagne !'],
      ['nina', 'happy', 'Et moi, des frites. Parce qu’on a toujours besoin de frites.'],
      ['marcel', 'happy', 'Avec vous, je ne cuisine plus tout seul. C’est ça, mon ingrédient secret.']] },
    { id: 's2c11', day: 42, s: 2, title: 'Le grand concours', lines: [
      ['benali', 'neutral', 'Bienvenue au grand concours de l’île ! Je suis la présidente du jury. Chefs, vous avez une heure.'],
      ['', '', 'Gaston prépare un plat d’une perfection glaciale. Marcel cuisine un repas avec un ingrédient de chaque ami.'],
      ['benali', 'neutral', 'Gaston, votre plat est parfait. Techniquement parfait.'],
      ['benali', 'happy', 'Marcel… votre plat raconte une histoire. En le goûtant, j’ai vu la jungle, la mer et la montagne.'],
      ['benali', 'happy', 'Le vainqueur est… Chef Marcel !'],
      ['rival', 'worried', 'J’ai… perdu ?']] },
    { id: 's2c12', day: 44, s: 2, title: 'Une grande famille', reward: 'finale2', lines: [
      ['rival', 'worried', 'Marcel… Je dois partir. C’était notre accord.'],
      ['marcel', 'happy', 'Non, Gaston. Reste. Viens cuisiner avec nous. Ici, personne ne crie : on s’entraide.'],
      ['rival', 'worried', 'Après tout ce que je t’ai fait à Paris ? Pourquoi ?'],
      ['marcel', 'happy', 'Parce que tu es un grand cuisinier. Il ne te manque qu’une chose : des amis à qui faire plaisir.'],
      ['rival', 'happy', '…Merci, Marcel. Je crois que je n’ai jamais goûté quelque chose d’aussi bon que ce mot.'],
      ['papi', 'happy', 'Quatre restaurants, une grande famille. Ta tante serait si fière de toi.'],
      ['', '', 'Fin de la Saison 2. Les quatre restaurants restent ouverts : continue à faire grandir ton empire !']] }
  ];
  CHAPTERS2.forEach(function (c, i) { c.n = i; CH_BY_ID[c.id] = c; });
  var SEASONS = [
    { n: 1, title: 'Saison 1 : Le resto de la jungle', list: CHAPTERS },
    { n: 2, title: 'Saison 2 : Le tour de l’île', list: CHAPTERS2 }
  ];
  function allChapters() { return CHAPTERS.concat(CHAPTERS2); }


  // ---------------- regulars' little stories (unlocked by friendship) ----------------
  var TALES = {
    capitaine: [
      { title: 'La Perle Bleue', lines: [
        ['capitaine', 'happy', 'Ma Perle Bleue a quarante ans. Elle grince, elle fuit un peu… mais elle n’a jamais abandonné personne.'],
        ['marcel', 'happy', 'Un peu comme mon vieux grill !'],
        ['capitaine', 'happy', 'Exactement. Les vieilles choses qu’on aime ne nous lâchent jamais.']] },
      { title: 'Lire les étoiles', lines: [
        ['capitaine', 'neutral', 'Mon grand-père naviguait sans boussole. Il lisait les étoiles et la couleur des vagues.'],
        ['marcel', 'focus', 'Moi, je lis les saveurs. Un peu de sel, un peu de citron… et je sais où je vais.'],
        ['capitaine', 'happy', 'Chacun sa carte, Chef. Le tout, c’est de bien connaître sa mer.']] },
      { title: 'Le port d’attache', lines: [
        ['capitaine', 'worried', 'Tu sais, après chaque voyage, je n’avais nulle part où rentrer.'],
        ['capitaine', 'happy', 'Maintenant, quand je vois la lumière de ton restaurant depuis la mer, je sais que je suis arrivée.'],
        ['marcel', 'happy', 'Alors laisse-moi allumer la lanterne tous les soirs, Capitaine.']] }],
    nina: [
      { title: 'Le roi des frites', lines: [
        ['nina', 'happy', 'Mon secret ? Je coupe les pommes de terre en musique. Le rythme de la samba, c’est la bonne épaisseur !'],
        ['marcel', 'focus', 'Je n’avais jamais entendu parler de cette technique…'],
        ['nina', 'happy', 'Parce que je viens de l’inventer ! Mais ça marche, goûte !']] },
      { title: 'Le rêve de Rio', lines: [
        ['nina', 'neutral', 'Ma mère vendait des pastéis sur la plage de Rio. Je l’aidais tous les dimanches.'],
        ['nina', 'worried', 'Elle me manque. Mais quand je cuisine, j’ai l’impression qu’elle est juste à côté de moi.'],
        ['marcel', 'happy', 'Les recettes sont faites pour ça : garder les gens qu’on aime près de nous.']] },
      { title: 'Un camion tout neuf', min: 's2c12', lines: [
        ['nina', 'happy', 'Chef ! Tu ne devineras jamais : Gaston m’a aidée à repeindre mon camion !'],
        ['marcel', 'happy', 'Gaston ? Avec un pinceau ?'],
        ['nina', 'happy', 'Il a même dessiné une frite avec une moustache dessus. Je crois qu’il fait un effort !']] }],
    guide: [
      { title: 'Le sommet', lines: [
        ['guide', 'happy', 'Demain, je t’emmène voir le lever du soleil depuis le sommet. Il faut partir à quatre heures.'],
        ['marcel', 'worried', 'Quatre heures… du matin ?'],
        ['guide', 'happy', 'Avec un thermos de soupe, tu ne sentiras même pas le froid. Promis !']] },
      { title: 'Les herbes sauvages', lines: [
        ['guide', 'neutral', 'Ce petit brin, c’est du thym sauvage. Celui-là, de l’ail des ours. La montagne est un grand potager.'],
        ['marcel', 'happy', 'Tu viens de me donner dix idées de recettes !'],
        ['guide', 'happy', 'Ma grand-mère disait : « Qui connaît les plantes ne mange jamais mal. »']] },
      { title: 'Le chalet revit', lines: [
        ['guide', 'happy', 'Grand-mère est venue dîner hier soir. Elle a pleuré en voyant toutes les tables pleines.'],
        ['guide', 'neutral', 'Elle a dit que le chalet avait retrouvé son âme. Et c’est grâce à toi.'],
        ['marcel', 'happy', 'C’est grâce à nous tous, Élise. Moi, je n’ai fait que la soupe.']] }],
    rival: [
      { title: 'Le petit apprenti', min: 's2c11', lines: [
        ['rival', 'neutral', 'Tu te souviens de ton premier jour à Paris ? Tu as fait tomber un plateau entier de soufflés.'],
        ['marcel', 'worried', 'Ne me le rappelle pas… Tu m’avais crié dessus pendant une heure.'],
        ['rival', 'worried', 'Je sais. Je suis désolé, Marcel. J’avais peur de rater, alors je faisais peur aux autres.']] },
      { title: 'La première recette', min: 's2c12', lines: [
        ['rival', 'happy', 'La première chose que j’ai cuisinée, enfant, c’était un gâteau pour ma petite sœur.'],
        ['rival', 'neutral', 'Il était raté. Elle l’a mangé jusqu’à la dernière miette en disant que c’était le meilleur du monde.'],
        ['marcel', 'happy', 'Tu vois ? Tu as toujours su cuisiner avec le cœur. Tu l’avais juste oublié.']] },
      { title: 'Un nouveau Gaston', min: 's2c12', lines: [
        ['rival', 'happy', 'Aujourd’hui, j’ai appris à Léo à faire une crème brûlée. Il m’a dit merci !'],
        ['rival', 'happy', 'Tu sais quoi, Marcel ? C’est bien plus agréable que de crier.'],
        ['marcel', 'happy', 'Bienvenue dans la famille, Gaston.']] }],
    papi: [
      { title: 'Le grand banyan', lines: [
        ['papi', 'happy', 'Tu vois ce grand arbre, derrière ? Il a plus de trois cents ans.'],
        ['papi', 'neutral', 'Petit, j’y grimpais pour voler des mangues. Ma mère me grondait… puis elle en faisait de la confiture.'],
        ['marcel', 'happy', 'Ça me donne une idée de dessert !']] },
      { title: 'La règle du grand-père', lines: [
        ['papi', 'neutral', 'Mon grand-père disait : « La jungle te donne ce dont tu as besoin, jamais plus. »'],
        ['marcel', 'focus', 'C’est une belle règle pour une cuisine aussi : ne rien gâcher.'],
        ['papi', 'happy', 'Tu apprends vite, Marcel. Tu deviens un vrai enfant du village.']] },
      { title: 'Une place à table', lines: [
        ['papi', 'worried', 'Tu sais, depuis que ma femme est partie, je mangeais souvent seul.'],
        ['papi', 'happy', 'Maintenant, chaque soir, j’ai une soupe chaude et des amis autour de moi. Merci, Chef.'],
        ['marcel', 'happy', 'Ta place est réservée pour toujours, Papi.']] }],
    explorateur: [
      { title: 'Les cicatrices', lines: [
        ['hugo', 'happy', 'Cette cicatrice ? Un crocodile, en Amazonie. Enfin… un très gros lézard.'],
        ['marcel', 'focus', 'Et celle-là, sur la main ?'],
        ['hugo', 'worried', 'Ça… c’est en ouvrant une boîte de conserve.']] },
      { title: 'La boussole', lines: [
        ['hugo', 'neutral', 'Cette boussole appartenait à mon père. Lui aussi cherchait le Temple du Goût.'],
        ['marcel', 'worried', 'Il ne l’a jamais trouvé ?'],
        ['hugo', 'happy', 'Non. Mais il disait que le voyage compte plus que le trésor. Je commence à comprendre.']] },
      { title: 'Un endroit où revenir', min: 'c9', lines: [
        ['hugo', 'happy', 'Je repars bientôt en expédition. Mais avant, je voulais te dire merci.'],
        ['hugo', 'neutral', 'Partout où je vais, je n’ai jamais de maison. Ici, c’est un peu devenu la mienne.'],
        ['marcel', 'happy', 'La porte sera toujours ouverte, Hugo. Et le grill toujours chaud.']] }],
    mamie: [
      { title: 'La friterie du port', lines: [
        ['mamie', 'happy', 'Ma friterie s’appelait « Chez Lila ». Les gens faisaient la queue jusqu’au port !'],
        ['marcel', 'focus', 'Et pourquoi avez-vous fermé ?'],
        ['mamie', 'neutral', 'Mes genoux ont pris leur retraite avant moi ! Mais mon cœur, lui, cuisine encore.']] },
      { title: 'Le carnet secret', lines: [
        ['mamie', 'neutral', 'Tiens. C’est mon carnet de recettes. Quarante ans de secrets.'],
        ['marcel', 'worried', 'Mamie… Je ne peux pas accepter, c’est trop précieux !'],
        ['mamie', 'happy', 'Une recette qu’on ne partage pas est une recette qui meurt. Prends-le.']] },
      { title: 'Le héros de Léo', lines: [
        ['mamie', 'happy', 'Léo ne parle que de toi : « Chef Marcel a dit ceci, Chef Marcel a fait cela… »'],
        ['mamie', 'worried', 'Ses parents travaillent loin. Tu es un peu son héros, tu sais.'],
        ['marcel', 'happy', 'Et lui, c’est mon meilleur apprenti. Ne lui dites pas, il va prendre la grosse tête !']] }],
    garcon: [
      { title: 'La toque en papier', lines: [
        ['leo', 'happy', 'Chef, regarde ! Je me suis fait une toque en papier !'],
        ['marcel', 'happy', 'Superbe ! Elle est presque plus haute que la mienne.'],
        ['leo', 'happy', 'C’est normal : un jour, je serai un encore plus grand chef que toi !']] },
      { title: 'Le gâteau raté', lines: [
        ['leo', 'worried', 'J’ai fait un gâteau pour Mamie… Il est tout plat et un peu brûlé.'],
        ['marcel', 'focus', 'Tu sais combien de gâteaux j’ai ratés ? Des centaines !'],
        ['marcel', 'happy', 'Un gâteau raté, c’est une leçon. Un gâteau fait avec amour, c’est un cadeau. Le tien est les deux.'],
        ['leo', 'happy', 'Alors Mamie va recevoir une leçon ET un cadeau !']] },
      { title: 'Le premier service', lines: [
        ['leo', 'happy', 'Chef ! J’ai servi une pizza tout seul, et le monsieur m’a dit merci !'],
        ['marcel', 'happy', 'Bravo, Léo ! Ce sourire-là, c’est la plus belle paie du monde.'],
        ['leo', 'happy', 'Je m’en souviendrai toute ma vie !']] }],
    touriste: [
      { title: 'Cinquante pays', lines: [
        ['awa', 'happy', 'J’ai visité cinquante pays ! Mais nulle part je ne me suis sentie aussi bien qu’ici.'],
        ['marcel', 'focus', 'Qu’est-ce qui rend cet endroit spécial, d’après toi ?'],
        ['awa', 'neutral', 'Le temps. Ici, personne ne regarde sa montre.']] },
      { title: 'Le jus de maman', lines: [
        ['awa', 'worried', 'Ce matin, ma famille me manquait… Ma maman fait un jus de bissap incroyable.'],
        ['marcel', 'happy', 'Décris-le-moi. Je vais essayer de le refaire pour toi.'],
        ['awa', 'happy', 'Tu ferais ça ? Chef, tu es un amour !']] },
      { title: 'Poser ses valises', lines: [
        ['awa', 'happy', 'J’ai pris une décision : je pose mes valises ici pour un moment !'],
        ['marcel', 'happy', 'C’est vrai ? Le village va être ravi.'],
        ['awa', 'happy', 'Et toi, tu gagnes une cliente fidèle… et très gourmande !']] }],
    affaires: [
      { title: 'Toujours pressé', lines: [
        ['tanaka', 'neutral', 'Trois réunions, deux avions, un seul déjeuner. Faites vite.'],
        ['marcel', 'focus', 'Ici, la cuisine prend le temps qu’il faut. Mais je vous promets que ça vaut le coup.'],
        ['tanaka', 'worried', '…C’est bien la première fois que quelqu’un me fait attendre.']] },
      { title: 'La vieille photo', min: 'c10', lines: [
        ['tanaka', 'neutral', 'Cette photo ? C’est moi, enfant, dans la pâtisserie de ma mère, à Osaka.'],
        ['marcel', 'happy', 'Vous vouliez devenir pâtissier ?'],
        ['tanaka', 'worried', 'J’ai choisi les affaires, c’était plus sérieux… Je ne sais plus si c’était le bon choix.']] },
      { title: 'Un nouveau rêve', min: 'c12', lines: [
        ['tanaka', 'happy', 'J’ai réfléchi. Je vais construire quelque chose ici… mais pas un hôtel.'],
        ['tanaka', 'happy', 'Une école de cuisine pour les enfants du village. Léo sera mon premier élève.'],
        ['marcel', 'happy', 'Ça, Kenji, c’est le plus beau projet du monde.']] }],
    photographe: [
      { title: 'Le toucan farceur', lines: [
        ['zuri', 'happy', 'J’ai attendu six heures dans un arbre pour photographier un toucan.'],
        ['marcel', 'focus', 'Six heures ! Et alors ?'],
        ['zuri', 'worried', 'Il s’est posé pile sur mon objectif. J’ai une magnifique photo… de plumes.']] },
      { title: 'Apprendre à regarder', lines: [
        ['zuri', 'neutral', 'Mon métier, c’est d’apprendre à regarder. La beauté se cache dans les petits détails.'],
        ['zuri', 'happy', 'Comme la vapeur sur tes nouilles, ou le sourire de Léo quand il goûte une sauce.'],
        ['marcel', 'happy', 'Je ne verrai plus jamais ma cuisine de la même façon.']] },
      { title: 'L’exposition', lines: [
        ['zuri', 'happy', 'Je prépare une exposition : « Les visages de la jungle ». Et je veux ta photo, Chef.'],
        ['marcel', 'worried', 'Moi ? Avec ma moustache pleine de farine ?'],
        ['zuri', 'happy', 'Surtout avec ta moustache pleine de farine !']] }],
    surfeur: [
      { title: 'La plus grosse vague', lines: [
        ['kai', 'happy', 'Ce matin, j’ai pris la plus grosse vague de ma vie ! J’ai crié si fort que les poissons ont eu peur.'],
        ['marcel', 'happy', 'Du coup… pas de poisson aujourd’hui ?'],
        ['kai', 'worried', '…Pas de poisson aujourd’hui.']] },
      { title: 'Respecter l’océan', lines: [
        ['kai', 'neutral', 'Je ne pêche jamais plus que ce qu’il faut. L’océan, c’est comme un ami : on ne lui prend pas tout.'],
        ['marcel', 'focus', 'Papi Malo dit la même chose de la jungle.'],
        ['kai', 'happy', 'C’est Papi Malo qui m’a appris à surfer ! Enfin… surtout à tomber.']] },
      { title: 'Le cours de surf', lines: [
        ['kai', 'happy', 'Chef, demain matin, cours de surf pour toi. Pas d’excuse !'],
        ['marcel', 'worried', 'Moi, sur une planche ? Je vais couler comme une pierre !'],
        ['kai', 'happy', 'Tout le monde tombe au début. C’est en tombant qu’on apprend à tenir debout !']] }]
  };

  // ---------------- state helpers ----------------
  function S() { var s = App.save; if (!s.story) s.story = { seen: {}, read: {} }; if (!s.story.seen) s.story.seen = {}; if (!s.story.read) s.story.read = {}; if (!s.friends) s.friends = {}; if (!s.flags) s.flags = {}; return s; }
  function chapterUnlocked(ch) { return ch.day === 0 || S().unlocked > ch.day; }
  function unlockedId(id) { var c = CH_BY_ID[id]; return !!c && chapterUnlocked(c); }
  function introduced(cust) { return GD.introduced(S(), cust); }
  function friendPts(cust) { return S().friends[cust] || 0; }
  function taleUnlocked(cust, k) {
    var t = TALES[cust] && TALES[cust][k];
    if (!t || !introduced(cust)) return false;
    if (t.min && !unlockedId(t.min)) return false;
    return GD.friendLevel(friendPts(cust)) >= k + 1;
  }
  function unreadCount() {
    var s = S(), n = 0;
    allChapters().forEach(function (c) { if (chapterUnlocked(c) && !s.story.seen[c.id]) n++; });
    Object.keys(TALES).forEach(function (cust) { for (var k = 0; k < 3; k++) if (taleUnlocked(cust, k) && !s.story.read[cust + '_' + k]) n++; });
    return n + (window.Ach ? Ach.count() : 0);
  }
  function rewardCoins(f) { return Math.max(20, Math.round(GD.goalFor(Math.max(1, S().unlocked), S().mode) * f / 10) * 10); }

  // ---------------- dialogue player ----------------
  var P = null; // current playback
  function el(tag, cls, parent, html) { return UI.el(tag, cls, parent, html); }
  function px(v) { return Math.round(v) + 'px'; }

  // phones: a 720 px column. Wide screens: the scene uses the whole width, with bigger characters
  // on each side of a centred dialogue box and the wide picture of the current place behind.
  function geo() {
    var W = App.W, H = App.H, wide = !!App.wide, bw = wide ? Math.min(1240, W - 240) : W - 28;
    return { W: W, H: H, wide: wide, boxTop: H - 300, boxL: (W - bw) / 2, boxW: bw,
      cxL: wide ? W / 2 - Math.min(400, W * 0.21) : 200, cxR: wide ? W / 2 + Math.min(400, W * 0.21) : 520, k: wide ? 1.22 : 1 };
  }
  function applyGeo() {
    var g = geo();
    P.g = g; P.boxTop = g.boxTop;
    P.root.style.height = px(g.H);
    P.box.style.top = px(g.boxTop); P.box.style.left = px(g.boxL); P.box.style.right = 'auto'; P.box.style.width = px(g.boxW);
    P.name.style.top = px(g.boxTop - 50);
    P.sign.style.top = px(Math.max(150, g.boxTop - (g.wide ? 720 : 640)));
    P.sign.style.left = px((g.W - 340) / 2);
    P.leafR.style.left = px(g.W - 200);
    P.counter.style.top = px(g.boxTop - 96);
    if (P.card.parentNode) P.card.style.top = px(g.H * 0.28);
    P.slots.L.cx = g.cxL; P.slots.R.cx = g.cxR;
    P.bg.style.backgroundImage = g.wide ? 'linear-gradient(rgba(8,26,6,.05), rgba(8,22,4,.2) 60%, rgba(5,15,3,.72)), var(--a-bgw_' + GD.locById(App.save.loc || 'jungle').id + ')' : '';
    ['L', 'R'].forEach(function (k) { var sl = P.slots[k]; if (sl.who) placeSlot(sl, CAST[sl.who]); });
    if (P.side) nameSide(P.side);
  }
  function nameSide(side) {
    P.side = side;
    var off = px(P.g.boxL + 30);
    P.name.style.left = side === 'L' ? off : 'auto'; P.name.style.right = side === 'L' ? 'auto' : off;
  }

  function play(item, done) {
    if (P) end(true);
    var H = App.H, stage = document.getElementById('stage');
    var root = el('div', 'story', stage);
    root.style.height = px(H);
    var bg = el('div', 'st-bg', root);
    var boxTop = H - 300;
    // the little restaurant behind the characters: hanging sign, palm leaves, wooden counter
    var sg = el('div', 'st-sign', root, '<div class="ropes"></div><div class="board-s"></div><span>' + esc(App.save.name || 'Chez Cuistot') + '</span>');
    sg.style.top = px(Math.max(150, boxTop - 640));
    el('div', 'roof-leaf st-leaf l', root);
    var leafR = el('div', 'roof-leaf st-leaf r', root);
    var cnt = el('div', 'st-counter', root);
    cnt.style.top = px(boxTop - 96);
    var slots = {
      L: { el: el('div', 'st-chr', root), who: null, cx: 200 },
      R: { el: el('div', 'st-chr', root), who: null, cx: 520 }
    };
    var name = el('div', 'st-name', root);
    var box = el('div', 'st-box wait', root, '<div class="st-text"></div><i class="st-next"></i>');
    box.style.top = px(boxTop);
    name.style.top = px(boxTop - 50);
    var text = box.querySelector('.st-text'), next = box.querySelector('.st-next');
    var skip = el('div', 'pill st-skip tap', root, 'PASSER');
    var card = el('div', 'st-card', root, '<div class="leaf"><span class="sm">' + esc(item.kicker || '') + '</span></div><div class="sub">' + esc(fr(item.title || '')) + '</div>');
    card.style.top = px(H * 0.28);
    P = { root: root, item: item, i: -1, slots: slots, boxTop: boxTop, name: name, box: box, text: text, next: next, card: card, sign: sg, counter: cnt, bg: bg, leafR: leafR, typing: false, full: '', t0: 0, done: done, raf: 0 };
    applyGeo();
    skip.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); end(false); });
    root.addEventListener('click', function () { tap(); });
    Sfx.play('page');
    P.cardTimer = setTimeout(function () { if (P && P.i < 0) tap(); }, 2200);
    loop();
  }

  function layout() { if (P) applyGeo(); }
  function placeSlot(sl, cast) {
    var k = P.g.k, w = (cast.big ? 520 : 390) * k, h = 520 * k;
    sl.el.style.width = px(w); sl.el.style.height = px(h);
    sl.el.style.left = px(sl.cx - w / 2);
    sl.el.style.top = px(P.boxTop + 34 - h);
  }

  function showLine(k) {
    var line = P.item.lines[k];
    P.i = k;
    var who = line[0], mood = line[1], txt = fr(line[2]);
    var c = CAST[who];
    if (c) {
      var sl = P.slots[c.side], other = P.slots[c.side === 'L' ? 'R' : 'L'];
      var key = 'var(--a-' + c.spr(mood) + ')';
      if (sl.who !== who) {
        sl.el.classList.remove('on');
        var e = sl.el;
        setTimeout(function () { if (!P) return; placeSlot(sl, c); e.style.backgroundImage = key; e.classList.add('on'); }, sl.who ? 160 : 0);
        sl.who = who;
      } else sl.el.style.backgroundImage = key;
      sl.el.classList.remove('dim');
      if (other.who) other.el.classList.add('dim');
      P.name.textContent = c.name; P.name.style.display = 'block';
      nameSide(c.side);
      P.text.classList.remove('narr');
    } else {
      P.name.style.display = 'none';
      P.slots.L.el.classList.add('dim'); P.slots.R.el.classList.add('dim');
      P.text.classList.add('narr');
    }
    P.full = txt; P.typing = true; P.t0 = performance.now();
    P.next.style.display = 'none';
    Sfx.play('page');
  }

  function loop() {
    if (!P) return;
    if (P.typing) {
      var n = Math.min(P.full.length, Math.floor((performance.now() - P.t0) * 0.048));
      P.text.innerHTML = esc(P.full.slice(0, n)) + '<span class="st-rest">' + esc(P.full.slice(n)) + '</span>';
      if (n >= P.full.length) { P.typing = false; P.next.style.display = 'block'; }
    }
    P.raf = requestAnimationFrame(loop);
  }

  function tap() {
    if (!P) return;
    if (P.i < 0) {
      clearTimeout(P.cardTimer);
      P.card.classList.add('out');
      var c = P.card; setTimeout(function () { c.remove(); }, 300);
      P.box.classList.remove('wait');
      showLine(0); return;
    }
    if (P.typing) { P.n = P.full.length; P.t0 = -1e9; return; }
    if (P.i + 1 < P.item.lines.length) showLine(P.i + 1);
    else end(false);
  }

  function end(silent) {
    if (!P) return;
    var cur = P; P = null;
    clearTimeout(cur.cardTimer);
    cancelAnimationFrame(cur.raf);
    cur.root.classList.add('closing');
    setTimeout(function () { cur.root.remove(); }, 260);
    if (!silent && cur.done) cur.done();
  }

  // ---------------- chapters & tales ----------------
  function playChapter(id, done) {
    var ch = CH_BY_ID[id];
    if (!ch) { if (done) done(); return; }
    var first = !S().story.seen[id];
    var kick = ch.s === 2 ? (ch.n === 0 ? 'SAISON 2' : 'SAISON 2 • CHAP. ' + ch.n) : ch.n === 0 ? 'PROLOGUE' : 'CHAPITRE ' + ch.n;
    play({ kicker: kick, title: ch.title, lines: ch.lines }, function () {
      var s = S();
      s.story.seen[id] = 1;
      Store.save(s);
      refreshBadge();
      if (first && (ch.n > 0 || ch.s === 2)) giveChapterReward(ch, done);
      else if (done) done();
    });
  }
  function giveChapterReward(ch, done) {
    var s = S();
    if (ch.reward === 'livre') {
      s.flags.livre = true;
      var c1 = rewardCoins(1);
      s.coins += c1;
      Store.save(s);
      UI.reward('TRÉSOR !', '<b>Le Grand Livre des Saveurs</b><br>Tous tes plats rapportent <b>10 % de plus</b>, pour toujours !<br>+' + Util.fmt(c1) + ' <img class="coin" src="' + Art.coin() + '">', 'book', done);
    } else if (ch.unlockLoc) {
      var L = GD.locById(ch.unlockLoc), c4 = rewardCoins(1);
      s.coins += c4; Store.save(s);
      UI.reward('NOUVEAU LIEU !', 'Le restaurant <b>' + esc(L.resto) + '</b> t’attend !<br>Spécialités : ' + L.special.map(function (d) { return GD.STATIONS.filter(function (x) { return x.dish === d; })[0].dishName; }).join(' et ') + ' (+30 %)<br>+' + Util.fmt(c4) + ' <img class="coin" src="' + Art.coin() + '">', 'map', done);
    } else if (ch.reward === 'finale2') {
      var c5 = rewardCoins(4);
      s.coins += c5; Store.save(s);
      UI.reward('FIN DE SAISON 2 !', 'Quatre restaurants, une grande famille !<br>+' + Util.fmt(c5) + ' <img class="coin" src="' + Art.coin() + '">', 'star', done);
    } else if (ch.reward === 'finale') {
      var c2 = rewardCoins(3);
      s.coins += c2; Store.save(s);
      UI.reward('FIN DE SAISON !', 'Trois toques d’or pour <b>Chez Cuistot</b> !<br>+' + Util.fmt(c2) + ' <img class="coin" src="' + Art.coin() + '">', 'star', done);
    } else {
      var c3 = rewardCoins(0.5);
      s.coins += c3; Store.save(s);
      Sfx.play('coin');
      UI.toast('Chapitre terminé : +' + Util.fmt(c3) + ' pièces !');
      if (done) done();
    }
    if (window.Scene) Scene.refreshHud();
  }
  function playTale(cust, k, done) {
    var t = TALES[cust][k], p = GD.PEOPLE[cust];
    var key = cust + '_' + k, first = !S().story.read[key];
    play({ kicker: p.name.toUpperCase(), title: t.title, lines: t.lines }, function () {
      var s = S();
      s.story.read[key] = 1;
      if (first) {
        var c = rewardCoins([0.3, 0.6, 1][k]);
        s.coins += c;
        Sfx.play('coin');
        UI.toast('Histoire lue : +' + Util.fmt(c) + ' pièces !');
        Scene.refreshHud();
      }
      Store.save(s);
      refreshBadge();
      if (done) done();
    });
  }
  // after a won day: the chapter of that day plays the first time
  function afterDay(day, firstWin, done) {
    var ch = null;
    allChapters().forEach(function (c) { if (c.day === day && !ch) ch = c; });
    // two chapters on the same day (24): play the second one right after the first
    var next = null;
    allChapters().forEach(function (c) { if (c.day === day && c !== ch && !next) next = c; });
    if (ch && next && firstWin && !S().story.seen[ch.id]) {
      playChapter(ch.id, function () { if (!S().story.seen[next.id]) playChapter(next.id, done); else if (done) done(); });
      return;
    }
    if (ch && firstWin && !S().story.seen[ch.id]) playChapter(ch.id, done);
    else if (done) done();
  }

  // ---------------- journal ----------------
  var jTab = 'histoire';
  function openJournal(tab) {
    if (tab) jTab = tab;
    var wide = App.wide, w = wide ? 1300 : 720;
    var H = wide ? 1080 : Math.min(App.H - 40, 1240);
    var md = UI.modal(H, { tapOutside: false, w: w });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var b = UI.el('div', 'board', I); UI.pos(b, 20, 64, w - 40, H - 70);
      UI.el('div', 'leaf', I, '<span>CARNET</span>').style.cssText = 'left:' + px((w - 470) / 2) + ';top:-6px';
      var cl = UI.el('div', 'close tap', I); UI.pos(cl, w - 102, 50);
      cl.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); md.close(); });
      var tabs = UI.el('div', 'tabs', I); UI.pos(tabs, 70, 160);
      if (wide) { tabs.style.width = px(w - 140); tabs.style.justifyContent = 'center'; tabs.style.gap = '14px'; }
      [['histoire', 'Histoire'], ['habitues', 'Habitués'], ['succes', 'Succès']].forEach(function (t) {
        var n = t[0] === 'histoire' ? allChapters().filter(function (c) { return chapterUnlocked(c) && !S().story.seen[c.id]; }).length :
          t[0] === 'succes' ? Ach.count() :
          Object.keys(TALES).reduce(function (a, cust) { for (var k = 0; k < 3; k++) if (taleUnlocked(cust, k) && !S().story.read[cust + '_' + k]) a++; return a; }, 0);
        var tb = UI.el('div', 'tab tap' + (t[0] === jTab ? ' on' : ''), tabs, t[1]);
        tb.style.minWidth = '180px';
        if (n) UI.el('div', 'badge', tb, n);
        tb.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); jTab = t[0]; render(); });
      });
      var pp = UI.el('div', 'paper', I); UI.pos(pp, 46, 236, w - 92, H - 70 - 200);
      var list = UI.el('div', 'list' + (wide ? ' cols2' : ''), I); UI.pos(list, 80, 268, w - 158, H - 70 - 200 - 66);
      if (jTab === 'histoire') renderChapters(list, md, render);
      else if (jTab === 'succes') Ach.render(list, render);
      else renderPeople(list, md, render);
    }
    render();
    md.rec.refresh = render;
  }
  function renderChapters(list, md, rerender) {
    var s = S();
    SEASONS.forEach(function (season) {
    var head = UI.el('div', 'ptxt', list, '<b>' + esc(season.title) + '</b>');
    head.style.cssText = 'margin:' + (season.n > 1 ? '22px' : '0') + ' 0 12px;font-size:24px';
    season.list.forEach(function (c) {
      var un = chapterUnlocked(c), seen = !!s.story.seen[c.id];
      var r = UI.el('div', 'row chap' + (un ? '' : ' locked'), list);
      UI.el('div', 'num', r, c.n === 0 ? (season.n > 1 ? '★' : 'P') : c.n);
      UI.el('div', 'nm', r, c.n === 0 ? (season.n > 1 ? 'Ouverture' : 'Prologue') : 'Chapitre ' + c.n);
      UI.el('div', 'ds', r, un ? esc(fr(c.title)) : 'Débloqué en finissant le jour ' + c.day);
      if (!un) UI.el('div', 'lockinfo', r, '<i></i><span>Jour ' + c.day + '</span>');
      else {
        var b = UI.el('div', 'pill' + (seen ? ' brown' : ''), r, seen ? 'REVOIR' : 'LIRE');
        if (!seen) UI.el('div', 'badge newb', r, '!');
        b.classList.add('tap');
        b.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); md.close(function () { playChapter(c.id, function () { refreshBadge(); openJournal('histoire'); }); }); });
      }
    });
    });
  }
  function renderPeople(list, md, rerender) {
    UI.el('div', 'ptxt', list, 'Sers souvent tes habitués pour devenir amis.<br><span style="font-size:19px">Leur plat préféré compte double !</span>').style.cssText = 'margin:0 0 12px;font-size:22px';
    var grid = UI.el('div', 'pgrid', list);
    ORDER.forEach(function (cust) {
      var known = introduced(cust), p = GD.PEOPLE[cust];
      var card = UI.el('div', 'pcard tap' + (known ? '' : ' unknown'), grid);
      var ph = UI.el('div', 'ph', card); ph.style.backgroundImage = 'var(--a-cu_' + cust + '_' + (known ? 'happy' : 'neutral') + ')';
      UI.el('div', 'pn', card, known ? esc(p.name) : 'Chapitre ' + CH_BY_ID[p.intro].n);
      var hs = UI.el('div', 'hearts3', card);
      var lv = cust === 'critique' ? -1 : GD.friendLevel(friendPts(cust));
      if (lv >= 0) for (var k = 0; k < 3; k++) UI.el('i', k < lv ? 'on' : '', hs);
      var unread = 0; for (var q = 0; q < 3; q++) if (TALES[cust] && taleUnlocked(cust, q) && !S().story.read[cust + '_' + q]) unread++;
      if (unread) UI.el('div', 'badge', card, unread);
      card.addEventListener('click', function (e) {
        e.stopPropagation(); Sfx.play('click');
        if (!known) { UI.toast('Tu feras sa connaissance dans l’histoire (chapitre ' + CH_BY_ID[p.intro].n + ')'); return; }
        openProfile(cust);
      });
    });
  }
  function openProfile(cust) {
    var p = GD.PEOPLE[cust];
    var md = UI.modal(1060, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var b = UI.el('div', 'board b-a', I); UI.pos(b, 40, 70, 640, 970);
      UI.el('div', 'leaf', I, '<span' + (p.name.length > 9 ? ' class="sm"' : '') + '>' + esc(p.name.toUpperCase()) + '</span>').style.cssText = 'left:125px;top:0';
      var cl = UI.el('div', 'close tap', I); UI.pos(cl, 600, 56);
      cl.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); md.close(); });
      var pp = UI.el('div', 'paper p-a', I); UI.pos(pp, 86, 176, 548, 820);
      var ph = UI.el('div', 'prof-ph', I); UI.pos(ph, 100, 196, 220, 293);
      ph.style.backgroundImage = 'var(--a-cu_' + cust + '_happy)';
      var info = '<div class="prof-bio">' + esc(fr(BIO[cust])) + '</div>';
      if (p.fav) {
        var st = GD.STATIONS.filter(function (x) { return x.dish === p.fav; })[0];
        info += '<div class="prof-fav">Plat préféré : <img src="' + Art.dish(p.fav) + '"> <b>' + esc(st ? st.dishName : p.fav) + '</b></div>';
        var pts = friendPts(cust), lv = GD.friendLevel(pts), nxt = GD.FRIEND_LEVELS[Math.min(2, lv)];
        info += '<div class="prof-fr">Amitié : <span class="hearts3">' + [0, 1, 2].map(function (k) { return '<i class="' + (k < lv ? 'on' : '') + '"></i>'; }).join('') + '</span>' +
          (lv < 3 ? '<br><small>' + pts + ' / ' + nxt + ' visites</small>' : '<br><small>Amis pour la vie !</small>') + '</div>';
      }
      var t = UI.el('div', 'prof-info', I, info); UI.pos(t, 330, 200, 290);
      if (!TALES[cust]) {
        UI.el('div', 'ptxt', I, 'Mme Benali vient rarement…<br>Sers-la vite : elle paie le double !').style.cssText = 'position:absolute;left:110px;top:560px;width:500px;font-size:24px';
        return;
      }
      var y = 528;
      TALES[cust].forEach(function (tale, k) {
        var un = taleUnlocked(cust, k), read = !!S().story.read[cust + '_' + k];
        var r = UI.el('div', 'row tale' + (un ? '' : ' locked'), I); UI.pos(r, 110, y, 500, 128); y += 140;
        UI.el('div', 'num', r, k + 1);
        UI.el('div', 'nm', r, un ? esc(fr(tale.title)) : 'Histoire ' + (k + 1));
        UI.el('div', 'ds', r, un ? (read ? 'Déjà lue' : 'Nouvelle histoire !') : (GD.friendLevel(friendPts(cust)) >= k + 1 ? 'Suite de l’histoire principale…' : 'Amitié niveau ' + (k + 1)));
        if (!un) UI.el('div', 'lockinfo', r, '<i></i>');
        else {
          var bt = UI.el('div', 'pill tap' + (read ? ' brown' : ''), r, read ? 'RELIRE' : 'LIRE');
          bt.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); md.close(function () { playTale(cust, k, function () { refreshBadge(); openProfile(cust); }); }); });
        }
      });
    }
    render();
  }

  function refreshBadge() { if (window.Scene && Scene.refreshHud) Scene.refreshHud(); }

  return {
    CHAPTERS: CHAPTERS, CHAPTERS2: CHAPTERS2, allChapters: allChapters, TALES: TALES, CAST: CAST, WHO: WHO, BIO: BIO,
    play: play, playChapter: playChapter, playTale: playTale, afterDay: afterDay,
    openJournal: openJournal, openProfile: openProfile, unreadCount: unreadCount,
    introduced: introduced, taleUnlocked: taleUnlocked, active: function () { return !!P; },
    skip: function () { if (P) end(false); }, tap: tap, next: tap, layout: layout
  };
})();
