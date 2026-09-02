// frontend/src/components/CookiePreferences.jsx
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { useCookies } from '../hooks/useCookies';
import { toast } from 'sonner';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import PropTypes from 'prop-types';

export const CookiePreferences = () => {
  const { preferences, savePreferences, hasConsent } = useCookies();
  const [localPrefs, setLocalPrefs] = useState(preferences);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleSave = () => {
    savePreferences(localPrefs);
    toast.success('✅ Préférences enregistrées', {
      description: 'Vos choix ont été pris en compte.'
    });
  };

  if (!hasConsent) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00B894]" />
            Préférences cookies
          </CardTitle>
          <CardDescription>
            Vous n'avez pas encore donné votre consentement pour les cookies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Pour modifier vos préférences, veuillez d'abord accepter ou refuser les cookies via la bannière.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#00B894]" />
          Préférences cookies
        </CardTitle>
        <CardDescription>
          Gérez la façon dont nous utilisons vos données pour améliorer votre expérience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cookies fonctionnels */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Cookies fonctionnels</h3>
            <p className="text-sm text-gray-500">
              Nécessaires au bon fonctionnement de l'application (langue, session).
            </p>
          </div>
          <Switch
            checked={localPrefs.functional}
            disabled
            className="opacity-50 cursor-not-allowed"
          />
        </div>

        {/* Cookies analytics */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Cookies analytics</h3>
            <p className="text-sm text-gray-500">
              Nous aident à comprendre comment vous utilisez l'application.
            </p>
          </div>
          <Switch
            checked={localPrefs.analytics}
            onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, analytics: checked }))}
          />
        </div>

        {/* Cookies marketing */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Cookies marketing</h3>
            <p className="text-sm text-gray-500">
              Utilisés pour vous proposer des offres personnalisées.
            </p>
          </div>
          <Switch
            checked={localPrefs.marketing}
            onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, marketing: checked }))}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setLocalPrefs(preferences)}>
          Annuler
        </Button>
        <Button onClick={handleSave} className="bg-[#00B894] hover:bg-[#00a182]">
          <CheckCircle className="w-4 h-4 mr-2" />
          Enregistrer
        </Button>
      </CardFooter>
    </Card>
  );
};
CookiePreferences.propTypes = {};
