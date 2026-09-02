import React from 'react';
import { Link } from 'react-router-dom';
import { 
  DollarSign, TrendingUp, Award, Users, 
  ShoppingBag, Download, Star, ArrowRight,
  BarChart, PieChart, Target, Zap,
  Calendar, Globe, CreditCard, Wallet
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import PropTypes from 'prop-types';

const CreatorEconomy = ({ stats = {} }) => {
  // Données de démonstration pour 2025-2026
  const demoStats = {
    totalCreators: 1234,
    totalProducts: 5678,
    totalDownloads: 234567,
    totalEarnings: 456000000, // 456M FC
    averageRating: 4.8,
    topCategories: [
      { name: 'Développement', products: 1234, earnings: 156000000 },
      { name: 'Design', products: 987, earnings: 98000000 },
      { name: 'Marketing', products: 756, earnings: 67000000 },
      { name: 'Formation', products: 654, earnings: 89000000 }
    ],
    monthlyGrowth: 23.5,
    topCreators: [
      { name: 'Jean Dupont', earnings: 45600000, products: 24 },
      { name: 'Marie Martin', earnings: 38400000, products: 18 },
      { name: 'Pierre Durand', earnings: 32400000, products: 15 }
    ],
    recentTransactions: [
      { id: 't1', product: 'Formation React', amount: 149500, date: '2026-03-15' },
      { id: 't2', product: 'Template Dashboard', amount: 49900, date: '2026-03-14' },
      { id: 't3', product: 'Ebook IA', amount: 39500, date: '2026-03-13' }
    ],
    goals: {
      monthly: 75,
      quarterly: 45,
      yearly: 30
    }
  };

  const displayStats = { ...demoStats, ...stats };

  // Fonction pour formater l'argent en FC
  const formatMoney = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC';
  };

  // Fonction pour formater les nombres
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">💰 Économie des créateurs</h2>
            <p className="text-sm text-muted-foreground">Chiffres clés 2025-2026</p>
          </div>
        </div>
        <Link to="/creator-dashboard">
          <Button variant="ghost" className="text-green-400 hover:text-green-300 hover:bg-green-500/10 font-bold">
            Voir le dashboard <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 bg-card/60 border border-border/30 hover:bg-card/80 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Créateurs actifs</p>
              <p className="text-2xl font-black text-foreground">{formatNumber(displayStats.totalCreators)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card/60 border border-border/30 hover:bg-card/80 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Produits</p>
              <p className="text-2xl font-black text-foreground">{formatNumber(displayStats.totalProducts)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card/60 border border-border/30 hover:bg-card/80 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Téléchargements</p>
              <p className="text-2xl font-black text-foreground">{formatNumber(displayStats.totalDownloads)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card/60 border border-border/30 hover:bg-card/80 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Note moyenne</p>
              <p className="text-2xl font-black text-foreground">{displayStats.averageRating} ⭐</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Gains totaux et croissance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Gains totaux des créateurs</p>
              <p className="text-3xl font-black text-green-400">{formatMoney(displayStats.totalEarnings)}</p>
            </div>
            <Wallet className="w-8 h-8 text-green-400" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-green-400">+{displayStats.monthlyGrowth}%</span>
            <span className="text-muted-foreground">vs mois dernier</span>
          </div>
        </Card>

        <Card className="p-6 bg-card/60 border border-border/30">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-yellow-400" />
            Objectifs 2026
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Objectif mensuel</span>
                <span className="font-bold text-green-400">{displayStats.goals.monthly}%</span>
              </div>
              <Progress value={displayStats.goals.monthly} max={100} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Objectif trimestriel</span>
                <span className="font-bold text-blue-400">{displayStats.goals.quarterly}%</span>
              </div>
              <Progress value={displayStats.goals.quarterly} max={100} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Objectif annuel</span>
                <span className="font-bold text-purple-400">{displayStats.goals.yearly}%</span>
              </div>
              <Progress value={displayStats.goals.yearly} max={100} className="h-2" />
            </div>
          </div>
        </Card>
      </div>

      {/* Top catégories et créateurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Top catégories */}
        <Card className="p-5 bg-card/60 border border-border/30">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-400" />
            Catégories les plus rentables
          </h3>
          <div className="space-y-3">
            {displayStats.topCategories.map((cat, index) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{cat.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {cat.products} produits
                  </Badge>
                </div>
                <span className="text-sm font-bold text-green-400">{formatMoney(cat.earnings)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top créateurs */}
        <Card className="p-5 bg-card/60 border border-border/30">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" />
            Top créateurs 2026
          </h3>
          <div className="space-y-3">
            {displayStats.topCreators.map((creator, index) => (
              <div key={creator.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{creator.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {creator.products} produits
                  </Badge>
                </div>
                <span className="text-sm font-bold text-green-400">{formatMoney(creator.earnings)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Transactions récentes */}
      <Card className="p-5 bg-card/60 border border-border/30 mb-6">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          Transactions récentes
        </h3>
        <div className="space-y-2">
          {displayStats.recentTransactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{transaction.product}</p>
                <p className="text-xs text-muted-foreground">{new Date(transaction.date).toLocaleDateString('fr-FR')}</p>
              </div>
              <span className="text-sm font-bold text-green-400">{formatMoney(transaction.amount)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Appel à l'action */}
      <Card className="p-8 bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 text-center">
        <h3 className="text-2xl font-black text-foreground mb-3">Rejoignez l'économie des créateurs</h3>
        <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
          Plus de 1 200 créateurs gagnent déjà leur vie sur Smartix. 
          Vendez vos cours, templates et ebooks dès aujourd'hui.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/become-creator">
            <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-6 text-lg">
              Devenir créateur <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link to="/creator-academy">
            <Button size="lg" variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10 px-8 py-6 text-lg">
              Guide du créateur
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

// PropTypes
CreatorEconomy.propTypes = {
  stats: PropTypes.object
};

export default CreatorEconomy;
