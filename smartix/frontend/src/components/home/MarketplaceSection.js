import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, Star, Download, Eye, Users,
  ArrowRight, TrendingUp, Clock, Award,
  BookOpen, Code2, Palette, FileText,
  Sparkles, Zap, Plus
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import PropTypes from 'prop-types';

const MarketplaceSection = ({ products = [] }) => {
  // Données de démonstration avec prix en FC
  const demoProducts = {
    ebooks: [
      {
        id: '1',
        title: 'Guide complet React 18',
        type: 'ebook',
        author: 'Jean Dupont',
        price: 29500, // 29.500 FC
        rating: 4.8,
        downloads: 1234,
        image: null
      },
      {
        id: '2',
        title: 'Maîtriser TypeScript',
        type: 'ebook',
        author: 'Marie Martin',
        price: 24900, // 24.900 FC
        rating: 4.9,
        downloads: 2345,
        image: null
      },
      {
        id: '3',
        title: 'Node.js Avancé',
        type: 'ebook',
        author: 'Pierre Durand',
        price: 34900, // 34.900 FC
        rating: 4.7,
        downloads: 3456,
        image: null
      },
      {
        id: '4',
        title: 'UI/UX Design',
        type: 'ebook',
        author: 'Sophie Bernard',
        price: 19900, // 19.900 FC
        rating: 4.8,
        downloads: 4567,
        image: null
      }
    ],
    formations: [
      {
        id: '5',
        title: 'Formation Complète React',
        type: 'formation',
        author: 'Jean Dupont',
        price: 149500, // 149.500 FC
        rating: 4.9,
        students: 1234,
        duration: '20h',
        image: null
      },
      {
        id: '6',
        title: 'Développeur Full-Stack',
        type: 'formation',
        author: 'Marie Martin',
        price: 199500, // 199.500 FC
        rating: 4.8,
        students: 2345,
        duration: '40h',
        image: null
      },
      {
        id: '7',
        title: 'Mobile avec React Native',
        type: 'formation',
        author: 'Pierre Durand',
        price: 179500, // 179.500 FC
        rating: 4.7,
        students: 3456,
        duration: '30h',
        image: null
      },
      {
        id: '8',
        title: 'IA et Machine Learning',
        type: 'formation',
        author: 'Sophie Bernard',
        price: 249500, // 249.500 FC
        rating: 4.9,
        students: 4567,
        duration: '35h',
        image: null
      }
    ],
    templates: [
      {
        id: '9',
        title: 'Dashboard Admin',
        type: 'template',
        author: 'TemplateMaster',
        price: 49900, // 49.900 FC
        rating: 4.8,
        downloads: 1234,
        category: 'Admin'
      },
      {
        id: '10',
        title: 'Landing Page Moderne',
        type: 'template',
        author: 'DesignPro',
        price: 29900, // 29.900 FC
        rating: 4.7,
        downloads: 2345,
        category: 'Marketing'
      },
      {
        id: '11',
        title: 'E-commerce Starter',
        type: 'template',
        author: 'ShopDev',
        price: 79900, // 79.900 FC
        rating: 4.9,
        downloads: 3456,
        category: 'E-commerce'
      },
      {
        id: '12',
        title: 'Blog Template',
        type: 'template',
        author: 'ContentCreator',
        price: 19900, // 19.900 FC
        rating: 4.6,
        downloads: 4567,
        category: 'Blog'
      }
    ]
  };

  // Fonction pour formater le prix en FC
  const formatPrice = (price) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC';
  };

  const displayProducts = products.length > 0 ? products : demoProducts;

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">🛒 Marketplace</h2>
            <p className="text-sm text-muted-foreground">Achetez et vendez vos créations</p>
          </div>
        </div>
        <Link to="/smartix-store">
          <Button variant="ghost" className="text-green-400 hover:text-green-300 hover:bg-green-500/10 font-bold">
            Voir tout <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Tabs pour les catégories */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="ebooks">Ebooks</TabsTrigger>
          <TabsTrigger value="formations">Formations</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Tous les produits */}
        <TabsContent value="all">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...demoProducts.ebooks.slice(0, 2), ...demoProducts.formations.slice(0, 1), ...demoProducts.templates.slice(0, 1)].map((product) => (
              <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
            ))}
          </div>
        </TabsContent>

        {/* Ebooks */}
        <TabsContent value="ebooks">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {demoProducts.ebooks.map((product) => (
              <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
            ))}
          </div>
        </TabsContent>

        {/* Formations */}
        <TabsContent value="formations">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {demoProducts.formations.map((product) => (
              <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
            ))}
          </div>
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {demoProducts.templates.map((product) => (
              <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Statistiques marketplace */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-green-400">12 345</div>
          <div className="text-xs text-muted-foreground">Produits vendus</div>
        </Card>
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-yellow-400">4.8 ⭐</div>
          <div className="text-xs text-muted-foreground">Note moyenne</div>
        </Card>
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-blue-400">567</div>
          <div className="text-xs text-muted-foreground">Créateurs actifs</div>
        </Card>
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-purple-400">45 600 000</div>
          <div className="text-xs text-muted-foreground">Gains créateurs (FC)</div>
        </Card>
      </div>

      {/* Section vendeur */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">💰 Devenez créateur</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Vendez vos ebooks, formations et templates sur Smartix
              </p>
              <Link to="/become-creator">
                <Button className="bg-green-500 hover:bg-green-600 text-white">
                  Commencer à vendre <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card/60 border border-border/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">📈 Produits tendance</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Découvrez ce qui se vend le mieux en ce moment
              </p>
              <Link to="/smartix-store/trending">
                <Button variant="outline" className="border-blue-500/30 text-blue-400">
                  Voir les tendances
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Composant ProductCard interne avec prix en FC
const ProductCard = ({ product, formatPrice }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'ebook': return BookOpen;
      case 'formation': return Award;
      case 'template': return Code2;
      default: return FileText;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'ebook': return 'text-blue-400';
      case 'formation': return 'text-purple-400';
      case 'template': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const Icon = getIcon(product.type);
  const iconColor = getColor(product.type);

  return (
    <Link to={`/smartix-store/${product.id}`}>
      <Card className="bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105 group">
        <div className="h-32 bg-gradient-to-br from-gray-700 to-gray-900 rounded-t-xl relative">
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-black/50 text-white border-0 capitalize">
              {product.type}
            </Badge>
          </div>
          <div className="absolute bottom-3 left-3">
            <div className="flex items-center gap-1 text-white/80 text-xs">
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="font-bold text-foreground mb-1 line-clamp-1 group-hover:text-green-400 transition-colors">
            {product.title}
          </h3>
          
          <p className="text-xs text-muted-foreground mb-2">par {product.author}</p>
          
          <div className="flex items-center gap-2 text-xs mb-2">
            <span className="flex items-center gap-1 text-yellow-400">
              <Star className="w-3 h-3" /> {product.rating}
            </span>
            <span className="text-muted-foreground">•</span>
            {product.downloads !== undefined && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Download className="w-3 h-3" /> {product.downloads}
              </span>
            )}
            {product.students !== undefined && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-3 h-3" /> {product.students}
              </span>
            )}
            {product.duration && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" /> {product.duration}
                </span>
              </>
            )}
          </div>

          {product.category && (
            <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="font-bold text-green-400">{formatPrice(product.price)}</span>
            <Button size="sm" variant="ghost" className="text-green-400">
              Voir
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  );
};

// PropTypes
MarketplaceSection.propTypes = {
  products: PropTypes.array
};

export default MarketplaceSection;
ProductCard.propTypes = {
  product: PropTypes.object.isRequired,
  formatPrice: PropTypes.any.isRequired,
};
