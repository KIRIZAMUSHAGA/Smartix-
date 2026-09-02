import json
import uuid
import random
import itertools
from datetime import datetime, timedelta, timezone

# --- BANQUES DE DONNÉES MASSIVES ---
# Plus de 150 prénoms et 150 noms par pays pour garantir 10 000+ combinaisons uniques

PRENOMS = {
    "RDC": [
        "Dieudonné", "Espérance", "Gloire", "Placide", "Merveille", "Kabasele", "Tshilombo", "Anny", "Faustin", "Bijou",
        "Kabange", "Ilunga", "Mukendi", "Kasongo", "Kalonji", "Mbuyi", "Tshanda", "Zola", "Nkusu", "Luvumbu",
        "Patient", "Grâce", "Providence", "Chance", "Béni", "Exaucé", "Israël", "Moïse", "David", "Samuel",
        "Ruth", "Esther", "Déborah", "Marie", "Jeanne", "Cécile", "Claudine", "Nadège", "Sylvie", "Berthe",
        "Alain", "Patrick", "Christian", "Serge", "Éric", "Didier", "Hervé", "Pascal", "Bernard", "François",
        "Jean-Pierre", "Jean-Paul", "Jean-Claude", "Jean-Marc", "Jean-Luc", "Jean-Marie", "Jean-Baptiste", "Jean-Louis", "Jean-Michel", "Jean-Yves",
        "Élisabeth", "Monique", "Véronique", "Thérèse", "Agnès", "Martine", "Christine", "Brigitte", "Nathalie", "Sandrine",
        "Prosper", "Fidèle", "Constant", "Parfait", "Aimé", "Désiré", "Bienvenu", "Innocent", "Modeste", "Sincère",
        "Victoire", "Gracia", "Gloria", "Bénédicte", "Joséphine", "Pélagie", "Scholastique", "Alphonsine", "Léontine", "Euphrasie",
        "Emmanuel", "Gabriel", "Raphaël", "Michel", "Daniel", "Joël", "Noël", "Abel", "Élie", "Ézéchiel",
        "Gédéon", "Josué", "Salomon", "Jonathan", "Nathanaël", "Timothée", "Barnabé", "Matthieu", "Luc", "Marc",
        "Jérémie", "Isaïe", "Amos", "Jonas", "Osée", "Zacharie", "Malachie", "Habacuc", "Sophonie", "Aggée",
        "Néhémie", "Esdras", "Job", "Siméon", "Lévi", "Ruben", "Juda", "Benjamin", "Joseph", "Jacob",
        "Abraham", "Isaac", "Éphraïm", "Manassé", "Caleb", "Aaron", "Éléazar", "Phinéas", "Gershom", "Merari",
        "Kohath", "Amram", "Yokébed", "Myriam", "Séphora", "Bilha", "Zilpa", "Dina", "Léa", "Rachel"
    ],
    "CI": [
        "Koffi", "Awa", "Yao", "Konan", "Adjoua", "Bakayoko", "Tiémoko", "Fatou", "Sidiki", "Mariam",
        "Bamba", "Doumbia", "Cissé", "Touré", "Diomandé", "Fofana", "Kouamé", "N'Guessan", "Gnanhouan", "Zogbo",
        "Akissi", "Affoué", "Ahou", "Amlan", "Amenan", "Assa", "Assata", "Brou", "Dabou", "Daouda",
        "Drissa", "Félix", "Gnépa", "Gouali", "Ibrahim", "Issouf", "Issa", "Kadiatou", "Karidja", "Kassoum",
        "Kéita", "Lacina", "Lamine", "Mamadou", "Massandjé", "Mohamed", "Moussa", "N'Dri", "Nanan", "Oumar",
        "Ousmane", "Rokia", "Salif", "Salimata", "Seydou", "Siaka", "Sita", "Souleymane", "Tano", "Yacouba",
        "Yéo", "Youssouf", "Zié", "Aïcha", "Aïssata", "Aminata", "Bintou", "Djénéba", "Fatoumata", "Hawa",
        "Kadidja", "Kadidjatou", "Korotoum", "Maimouna", "Mariam", "Minata", "Nassénéba", "Oumou", "Safiatou", "Sali",
        "Sanata", "Saran", "Tènin", "Adama", "Bakary", "Boubacar", "Cheick", "Daouda", "Dramane", "Fodé",
        "Gaoussou", "Hamidou", "Ibrahima", "Kalifa", "Lansana", "Madou", "Moriba", "Namory", "Oumarou", "Sékou",
        "Abdoulaye", "Aboubacar", "Adjaratou", "Alassane", "Awa", "Birahim", "Bréhima", "Cissoko", "Diaby", "Diakité",
        "Diarra", "Dosso", "Dramé", "Drissa", "Fadiga", "Fanta", "Gnagna", "Haidara", "Kanouté", "Karabinta",
        "Kassé", "Keita", "Konaté", "Koné", "Kouyaté", "Maïga", "Mara", "Mariko", "N'Diaye", "Niaré",
        "Ouédraogo", "Sacko", "Samaké", "Sangaré", "Savané", "Sissoko", "Sogoba", "Soumaré", "Sylla", "Tall",
        "Tamba", "Tamboura", "Tangara", "Togo", "Traoré", "Wagué", "Yattara", "Yéhia", "Zongo", "Zoungrana"
    ],
    "Sénégal": [
        "Moussa", "Khady", "Ousmane", "Aïssatou", "Abdoulaye", "Coumba", "Cheikh", "Aminata", "Ibrahima", "Ndeye",
        "Diop", "Fall", "Sow", "Ba", "Ndiaye", "Gueye", "Sy", "Sarr", "Thiam", "Diallo",
        "Seynabou", "Fatou", "Awa", "Mariama", "Adama", "Mame", "Papa", "Modou", "El Hadj", "Mamadou",
        "Alioune", "Babacar", "Cheikhou", "Demba", "Doudou", "Fallou", "Gora", "Habib", "Idrissa", "Ismaïla",
        "Khalifa", "Lamine", "Lat", "Macky", "Malick", "Mbaye", "Mor", "Ndongo", "Ousseynou", "Pape",
        "Sadio", "Samba", "Serigne", "Souleymane", "Tapha", "Thierno", "Yacine", "Youssou", "Abdou", "Alassane",
        "Aliou", "Amady", "Amadou", "Assane", "Bara", "Birame", "Boubacar", "Bécaye", "Cheikh Tidiane", "Djibril",
        "Elimane", "Fodé", "Hamidou", "Kane", "Khadim", "Maguette", "Mansour", "Massamba", "Meissa", "Niokhor",
        "Omar", "Oumar", "Penda", "Saliou", "Sanou", "Seckou", "Sidy", "Talla", "Wade", "Yamar",
        "Absa", "Adja", "Arame", "Astou", "Atta", "Bineta", "Codou", "Daba", "Dieynaba", "Diary",
        "Dior", "Fama", "Fatim", "Gnagna", "Khoudia", "Kiné", "Maguette", "Maréme", "Mbissine", "Merry",
        "Nabou", "Ndèye", "Néné", "Nogaye", "Oumou", "Ramatoulaye", "Rokhaya", "Safi", "Salimata", "Selbé",
        "Sokhna", "Soukeyna", "Tackho", "Thioro", "Yacine", "Yama", "Yaye", "Aïda", "Binta", "Dado",
        "Diarra", "Fanta", "Haby", "Kadiatou", "Korka", "Lala", "Maty", "Nafi", "Rama", "Sira",
        "Tennin", "Yandé", "Zeinab", "Zeynab", "Zoubaida", "Mbacké", "Diouf", "Faye", "Sène", "Wane"
    ],
    "France": [
        "Thomas", "Léa", "Nicolas", "Camille", "Julien", "Manon", "Antoine", "Chloé", "Maxime", "Sarah",
        "Hugo", "Emma", "Paul", "Alice", "Lucas", "Inès", "Arthur", "Jade", "Louis", "Lola",
        "Alexandre", "Amélie", "Bastien", "Béatrice", "Charles", "Charlotte", "Clément", "Clara", "Damien", "Diane",
        "Édouard", "Élodie", "Étienne", "Éva", "Fabien", "Fanny", "Florian", "Garance", "Guillaume", "Hélène",
        "Jean", "Jeanne", "Jérôme", "Julie", "Laurent", "Lucie", "Marc", "Marie", "Mathieu", "Nathalie",
        "Olivier", "Pauline", "Philippe", "Rachel", "Raphaël", "Roxane", "Sébastien", "Sophie", "Théo", "Valérie",
        "Vincent", "Zoé", "Adrien", "Agathe", "Baptiste", "Céline", "Denis", "Élise", "François", "Gabrielle",
        "Henri", "Isabelle", "Jacques", "Justine", "Kevin", "Laura", "Luc", "Margot", "Nathan", "Océane",
        "Pierre", "Quentin", "Romain", "Sandrine", "Simon", "Stéphanie", "Tristan", "Virginie", "Xavier", "Yaël",
        "Yann", "Aurélie", "Benoît", "Catherine", "David", "Émilie", "Fabrice", "Géraldine", "Hervé", "Ingrid",
        "Joël", "Karine", "Loïc", "Mélanie", "Noémie", "Pascal", "Rémi", "Sylvie", "Thierry", "Vanessa",
        "Arnaud", "Brigitte", "Cyril", "Delphine", "Emmanuel", "Frédéric", "Gilles", "Hortense", "Ivan", "Johanna",
        "Kévin", "Laetitia", "Matthias", "Nadia", "Ophélie", "Patricia", "Quitterie", "Richard", "Stéphane", "Thibault",
        "Valentin", "William", "Alexis", "Bruno", "Christophe", "Dominique", "Éric", "Florence", "Gaël", "Hubert",
        "Irène", "Jérémy", "Karl", "Lionel", "Maurice", "Nadine", "Patrick", "Rémy", "Serge", "Yvette"
    ],
    "Canada": [
        "William", "Florence", "Logan", "Alice", "Jacob", "Béatrice", "Liam", "Charlotte", "Noah", "Olivia",
        "Alexis", "Rosalie", "Édouard", "Zoe", "Samuel", "Mila", "Léo", "Maya", "Félix", "Livia",
        "Émile", "Juliette", "Gabriel", "Léonie", "Raphaël", "Emma", "Nathan", "Élizabeth", "Théodore", "Camille",
        "Mathis", "Maude", "Olivier", "Victoria", "Thomas", "Chloé", "Antoine", "Sophie", "Charles", "Rose",
        "Xavier", "Amélie", "Henri", "Zoey", "Louis", "Sarah", "Benjamin", "Lily", "Victor", "Clara",
        "Adam", "Éva", "Tristan", "Jade", "Justin", "Mya", "Maxime", "Ève", "Julien", "Annabelle",
        "Alexandre", "Laurence", "Philippe", "Simone", "Vincent", "Delphine", "Marc", "Audrey", "Jean", "Catherine",
        "Daniel", "Marie", "Pierre", "Anne", "André", "Louise", "Michel", "Marguerite", "François", "Jeanne",
        "Jacques", "Nicole", "Robert", "Denise", "Richard", "Hélène", "Bernard", "Suzanne", "Gilles", "Monique",
        "Claude", "Johanne", "Martin", "Sylvie", "Denis", "Francine", "Serge", "Ginette", "Alain", "Diane",
        "Guy", "Carole", "René", "Lise", "Marcel", "Céline", "Yves", "Linda", "Raymond", "Nathalie",
        "Paul", "Julie", "Roger", "Isabelle", "Georges", "Manon", "Lucien", "Caroline", "Maurice", "Lucie",
        "Normand", "Geneviève", "Mario", "Valérie", "Stéphane", "Karine", "Patrick", "Mélanie", "Sylvain", "Annie",
        "Éric", "Josée", "Christian", "Véronique", "Bruno", "Brigitte", "Marco", "Stéphanie", "Pascal", "Patricia",
        "Mathieu", "Martine", "Simon", "Chantal", "Hugo", "Nadia", "Sébastien", "Sandra", "Jonathan", "Jocelyne"
    ]
}

NOMS = {
    "RDC": [
        "Mutombo", "Luzolo", "Ngoma", "Kanyinda", "Mubiala", "Ilunga", "Mukendi", "Mbuyi", "Kasongo", "Kalonji",
        "Tshibangu", "Kabongo", "Muteba", "Kayembe", "Kalombo", "Mulumba", "Mwamba", "Ngalula", "Kapinga", "Banza",
        "Kabila", "Mobutu", "Lumumba", "Tshisekedi", "Katumbi", "Bemba", "Gizenga", "Kengo", "Monsengwo", "Mbeki",
        "Nzuzi", "Ntumba", "Tshibanda", "Mwenze", "Kalunga", "Ngoyi", "Mpiana", "Lelo", "Wemba", "Koffi",
        "Dikanga", "Bakajika", "Nseka", "Mbombo", "Kibambe", "Mampuya", "Ndombasi", "Ngandu", "Lukusa", "Mwana",
        "Tshibuabua", "Kabamba", "Katende", "Kapenga", "Kyungu", "Mputu", "Nkashama", "Tshimanga", "Wumba", "Zakuani",
        "Bolamba", "Bulambo", "Bwanga", "Diangienda", "Djamba", "Ekanga", "Elonga", "Epanya", "Fuamba", "Gata",
        "Ikoko", "Ilebo", "Kabasu", "Kadima", "Kafuka", "Kahemba", "Kakesa", "Kalala", "Kamanda", "Kamba",
        "Kamina", "Kanku", "Kapata", "Kasala", "Kaseka", "Katanga", "Kazembe", "Kazumba", "Kibonge", "Kikaya",
        "Kiluba", "Kimbembe", "Kimena", "Kimvula", "Kinkela", "Kinzambi", "Kisanga", "Kisimba", "Kitenge", "Kitutu",
        "Kongolo", "Kuanza", "Lubaki", "Luboya", "Lubuele", "Lukoki", "Lumbu", "Lundula", "Lupopo", "Lusala",
        "Lusamba", "Luvualu", "Lwamba", "Makila", "Makumba", "Malango", "Malela", "Mambu", "Mandiangu", "Mangala",
        "Mankenda", "Masamba", "Masela", "Matanda", "Matumona", "Mavinga", "Mbala", "Mbamba", "Mbaya", "Mbemba",
        "Mbenza", "Mboma", "Mbumba", "Mbunga", "Mikombe", "Milonga", "Miseku", "Moanda", "Mondele", "Mongombe",
        "Mpanzu", "Mpata", "Mpemba", "Mpiana", "Mpoyi", "Muamba", "Muanda", "Mudimbi", "Mugaruka", "Mukalayi"
    ],
    "CI": [
        "Coulibaly", "Ouattara", "Diallo", "Kouassi", "Diomandé", "Fofana", "Traoré", "Bamba", "Koné", "Yao",
        "Gueï", "Bédié", "Kouadio", "N'Dri", "Dibi", "Lamine", "Amon", "Tanoh", "Achi", "Duncan",
        "Ahoua", "Akaffou", "Akissi", "Allou", "Aman", "Assamoi", "Assémien", "Atsé", "Bahi", "Ballo",
        "Bédia", "Bléou", "Boni", "Boua", "Cissoko", "Dago", "Dembélé", "Diabaté", "Diakité", "Djè",
        "Doré", "Dosso", "Doumbia", "Fadiga", "Gnahoré", "Gnéba", "Gnonkondé", "Gouali", "Guéhi", "Guéi",
        "Kalou", "Kanga", "Karamoko", "Karidja", "Kassi", "Kéita", "Kla", "Kobenan", "Koffi", "Koita",
        "Kolia", "Konan", "Koné", "Koua", "Kouakou", "Kouamé", "Kouao", "Kouassi", "Koudou", "Kra",
        "Lago", "Lath", "Loba", "Méité", "N'Cho", "N'Da", "N'Goran", "N'Guessan", "N'Zi", "Niamké",
        "Okou", "Ouégnin", "Sangaré", "Sanogo", "Seri", "Siaka", "Sidibé", "Sissoko", "Soro", "Soumahoro",
        "Sylla", "Tano", "Té", "Tiémoko", "Toungara", "Touré", "Tra", "Yéboué", "Yéo", "Zakpa",
        "Zadi", "Zahoui", "Zamblé", "Zézé", "Zié", "Zingbé", "Zogbo", "Zongo", "Zoua", "Zoungrana",
        "Abé", "Adjobi", "Adou", "Agbré", "Aké", "Allangba", "Angaman", "Angui", "Appia", "Atséby",
        "Békoin", "Blé", "Bohui", "Brouh", "Ehouman", "Ehui", "Ekra", "Gnawa", "Gogui", "Gouly",
        "Grah", "Guédé", "Kacou", "Kanon", "Kassy", "Kaunan", "Kipré", "Koffi", "Koman", "Kouao",
        "Kraidy", "Lago", "Lou", "Mahi", "Mémel", "Mensah", "N'Dja", "N'Doua", "N'Takpé", "Niangoran"
    ],
    "Sénégal": [
        "Diop", "Ndiaye", "Sow", "Fall", "Ba", "Gueye", "Sy", "Diatta", "Kane", "Seck",
        "Mbacké", "Wade", "Sall", "Gaye", "Touré", "Diao", "Faye", "Mbow", "Cissé", "Lo",
        "Dieng", "Diouf", "Dramé", "Gning", "Ka", "Ly", "Mbaye", "Mbodj", "Ndao", "Ndour",
        "Niang", "Samb", "Sarr", "Sène", "Thiam", "Thiaw", "Thioub", "Thioune", "Wane", "Dème",
        "Diagne", "Diamé", "Diaw", "Diedhiou", "Diéye", "Dione", "Kébé", "Loum", "Ndiong", "Ndoye",
        "Ngom", "Pouye", "Sané", "Seydi", "Sonko", "Tall", "Thioye", "Badiane", "Badji", "Baldé",
        "Bâ", "Basse", "Bathily", "Bèye", "Bousso", "Camara", "Coly", "Coulibaly", "Dabo", "Daff",
        "Danfa", "Diakhaby", "Diakhaté", "Diakité", "Diallo", "Diamanka", "Dia", "Diarisso", "Diba", "Dièye",
        "Diokhané", "Drame", "Fadiga", "Gadiaga", "Gassama", "Gomis", "Guèye", "Hane", "Kandé", "Kanté",
        "Koné", "Kouyaté", "Lam", "Mané", "Mendy", "Ndianga", "Niasse", "Ousseini", "Sakho", "Samba",
        "Sané", "Séne", "Sidibé", "Sissoko", "Souaré", "Soumaré", "Sylla", "Tandian", "Touré", "Traoré",
        "Yague", "Yattassaye", "Yero", "Youm", "Zoumanigui", "Aïdara", "Cissokho", "Demba", "Diawara", "Doumbia",
        "Fadel", "Faty", "Guissé", "Haïdara", "Iyane", "Kama", "Keïta", "Koita", "Lèye", "Maiga",
        "Mar", "Mbathie", "Mbengue", "Ndiéguène", "Ndom", "Nguer", "Sagna", "Saidy", "Sané", "Sène",
        "Senghor", "Siby", "Sima", "Sonko", "Sougou", "Talla", "Tandia", "Thiombane", "Timera", "Wagué"
    ],
    "France": [
        "Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefebvre", "Garcia", "David", "Bertrand",
        "Roux", "Vincent", "Fournier", "Morel", "Girard", "Andre", "Lefevre", "Mercier", "Dupont", "Lambert",
        "Bonnet", "François", "Martinez", "Legrand", "Garnier", "Faure", "Rousseau", "Blanc", "Guerin", "Muller",
        "Henry", "Roussel", "Nicolas", "Perrin", "Morin", "Mathieu", "Clement", "Gauthier", "Dumont", "Lopez",
        "Fontaine", "Chevalier", "Robin", "Masson", "Sanchez", "Gerard", "Nguyen", "Boyer", "Denis", "Lemaire",
        "Duval", "Joly", "Gautier", "Roger", "Roche", "Roy", "Noel", "Meyer", "Lucas", "Meunier",
        "Jean", "Perez", "Marchand", "Dufour", "Blanchard", "Marie", "Barbier", "Brun", "Dumas", "Brunet",
        "Schmitt", "Leroux", "Colin", "Fernandez", "Pierre", "Renard", "Arnaud", "Rolland", "Caron", "Aubert",
        "Giraud", "Leclerc", "Vidal", "Boucher", "Grondin", "Hubert", "Renaud", "Riviere", "Picard", "Hamelin",
        "Dupuis", "Gaillard", "Adam", "Poirier", "Paris", "Jacquet", "Lacroix", "Fabre", "Guillaume", "Francois",
        "Baron", "Perrot", "Marty", "Benoit", "Leblanc", "Berger", "Maillard", "Collet", "Payet", "Rodriguez",
        "Renault", "Herve", "Schneider", "Philippe", "Lemoine", "Gerard", "Tessier", "Weber", "Fleury", "Lecomte",
        "Germain", "Evrard", "Daniel", "Baudry", "Leroy", "Blondel", "Hamon", "Bertin", "Mary", "Guyot",
        "Etienne", "Jacquot", "Didier", "Prevost", "Thierry", "Breton", "Humbert", "Marin", "Albert", "Hardy",
        "Charpentier", "Colin", "Voisin", "Pasquier", "Carlier", "Joubert", "Courtois", "Auger", "Poulain", "Regnier"
    ],
    "Canada": [
        "Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie", "Fortin", "Pelletier",
        "Belanger", "Levesque", "Leclerc", "Dufour", "Richard", "Simard", "Girard", "Beaulieu", "Caron", "Desjardins",
        "Bergeron", "Cloutier", "Fournier", "Poirier", "Martin", "Bélanger", "Ouellet", "Boucher", "Dubois", "Lapointe",
        "Cote", "Bernier", "Blais", "Bolduc", "Lachance", "Poulin", "Perreault", "Savard", "Giroux", "Gagnon",
        "Boudreau", "Langlois", "Lepage", "Deschenes", "Plante", "Trudel", "Labonte", "Therrien", "Fontaine", "Proulx",
        "Lambert", "Villeneuve", "Martel", "Turcotte", "Beaudoin", "Houle", "Mercier", "Theriault", "Bertrand", "Michaud",
        "Rousseau", "Lessard", "Audet", "Nadeau", "Tanguay", "Breton", "Allard", "Archambault", "Berube", "Bisson",
        "Boisvert", "Boutin", "Brousseau", "Brunet", "Carrier", "Charron", "Chartier", "Chretien", "Comeau", "Couture",
        "Demers", "Desrochers", "Drouin", "Dumont", "Dupuis", "Dussault", "Gingras", "Gosselin", "Gregoire", "Harvey",
        "Huard", "Hudon", "Jalbert", "Jean", "Jobin", "Jolicoeur", "Julien", "Lacasse", "Laflamme", "Lafontaine",
        "Lalonde", "Lamy", "Lanctot", "Landry", "Laprise", "Laroche", "Larose", "Latulippe", "Lavigne", "Lebel",
        "Leblanc", "Leclair", "Leduc", "Legault", "Lemay", "Lemieux", "Lepage", "Letourneau", "Marcoux", "Masse",
        "Mathieu", "Menard", "Nault", "Paquette", "Parent", "Payette", "Pelchat", "Petit", "Picard", "Plamondon",
        "Plourde", "Provencher", "Raymond", "Richer", "Rioux", "Robert", "Robitaille", "Rochette", "Rondeau", "Roussin",
        "Saint-Pierre", "Seguin", "Soucy", "St-Amand", "St-Jean", "St-Laurent", "St-Onge", "Tardif", "Thibeault", "Vachon"
    ]
}

VILLES = {
    "RDC": ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Goma", "Kisangani", "Bukavu", "Kananga", "Tshikapa", "Kolwezi", "Likasi", "Boma", "Matadi", "Butembo", "Kikwit", "Bandundu", "Mbandaka"],
    "CI": ["Abidjan", "Bouaké", "Daloa", "Yamoussoukro", "San-Pédro", "Korhogo", "Man", "Divo", "Gagnoa", "Anyama", "Dabou", "Grand-Bassam", "Jacqueville", "Sassandra", "Séguéla", "Odienné"],
    "Sénégal": ["Dakar", "Touba", "Thiès", "Kaolack", "Mbour", "Saint-Louis", "Rufisque", "Ziguinchor", "Diourbel", "Louga", "Tambacounda", "Richard-Toll", "Kolda", "Fatick", "Kédougou", "Matam"],
    "France": ["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Lille", "Nice", "Nantes", "Strasbourg", "Montpellier", "Rennes", "Le Havre", "Reims", "Toulon", "Grenoble", "Dijon"],
    "Canada": ["Montréal", "Québec", "Ottawa", "Toronto", "Vancouver", "Calgary", "Edmonton", "Winnipeg", "Halifax", "Sherbrooke", "Trois-Rivières", "Chicoutimi", "Gatineau", "Laval", "Longueuil", "Rimouski"]
}

COMPETENCES = [
    "Comptabilité générale", "OHADA", "Gestion de projet", "Finance d'entreprise",
    "Audit interne", "Marketing digital", "Droit des affaires", "Étudiant", 
    "Analyse de données", "Ressources Humaines", "Commerce international",
    "Fiscalité", "Contrôle de gestion", "Banque et finance", "Économie",
    "Entrepreneuriat", "Management", "Communication", "Relations publiques"
]

TONALITES = ["formel", "amical", "neutre"]
NIVEAUX_BAVARDAGE = ["faible", "normal", "expressif"]
TYPES_PROFIL = ["social", "conversationnel", "expert"]

def generate_temporal_signature(country):
    tz_offset = {"France": 1, "RDC": 1, "CI": 0, "Sénégal": 0, "Canada": -5}.get(country, 0)
    start_hour = random.randint(7, 10)
    end_hour = random.randint(18, 23)
    return {
        "temps_moyen_reponse_sec": random.randint(30, 900),
        "variance_reponse_pourcent": random.randint(20, 120),
        "heures_actives": [f"{start_hour:02d}:00-{end_hour:02d}:00"],
        "jours_faibles": random.sample(["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"], random.randint(1, 2)),
        "tz_offset": tz_offset
    }

def run_generation(total_count=10000):
    profiles = []
    used_names = set()
    
    dist = {"RDC": 0.50, "CI": 0.15, "Sénégal": 0.15, "France": 0.10, "Canada": 0.10}
    
    for country, weight in dist.items():
        count_for_country = int(total_count * weight)
        prenoms_list = PRENOMS[country]
        noms_list = NOMS[country]
        
        generated = 0
        attempts = 0
        max_attempts = count_for_country * 10
        
        while generated < count_for_country and attempts < max_attempts:
            attempts += 1
            prenom = random.choice(prenoms_list)
            nom = random.choice(noms_list)
            full_name = f"{prenom} {nom}"
            
            if full_name in used_names:
                continue
            
            used_names.add(full_name)
            
            profile_type = random.choices(TYPES_PROFIL, weights=[75, 20, 5])[0]
            created_months_ago = random.randint(6, 36)
            created_at = datetime.now(timezone.utc) - timedelta(days=created_months_ago * 30 + random.randint(0, 30))
            
            p = {
                "id": str(uuid.uuid4()),
                "email": f"sys.{uuid.uuid4().hex[:8]}@smartix.internal",
                "full_name": full_name,
                "prenom": prenom,
                "nom": nom,
                "age": random.randint(22, 48),
                "genre": random.choice(["M", "F", "N"]),
                "pays": country,
                "ville": random.choice(VILLES[country]),
                "langues": ["Français"] + ([random.choice(["Anglais", "Lingala", "Wolof", "Swahili"])] if random.random() > 0.5 else []),
                "competence_dominante": random.choice(COMPETENCES),
                "type_profil": profile_type,
                "niveau_bavardage": random.choice(NIVEAUX_BAVARDAGE),
                "tonalite": random.choice(TONALITES),
                "signature_temporelle": generate_temporal_signature(country),
                "is_profile_private": True,
                "is_system": True,
                "created_at": created_at.isoformat()
            }
            profiles.append(p)
            generated += 1
            
    random.shuffle(profiles)
    return profiles[:total_count]

if __name__ == "__main__":
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "system_profiles_10000.json")
    
    print("🚀 Génération de 10 000 profils système avec noms uniques...")
    data = run_generation(10000)
    
    names = [p["full_name"] for p in data]
    unique_names = set(names)
    print(f"📊 Profils générés: {len(data)}")
    print(f"📊 Noms uniques: {len(unique_names)}")
    
    if len(unique_names) < len(data):
        print(f"⚠️ Attention: {len(data) - len(unique_names)} noms en double détectés")
    else:
        print("✅ Tous les noms sont uniques!")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"✅ Terminé : {len(data)} profils générés dans {output_path}")
