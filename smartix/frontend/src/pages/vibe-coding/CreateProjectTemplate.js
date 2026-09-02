import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Wand2, FileText, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { projectService } from '../../vibe-coding/services/projectService'
import { templateService } from '../../vibe-coding/services/templateService'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import PropTypes from 'prop-types';

const CreateProjectTemplate = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [templates, setTemplates] = useState([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)

  React.useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true)
        const data = await templateService.getPublicTemplates()
        setTemplates(data?.templates || data || [])
      } catch (err) {
        console.error('Erreur chargement templates:', err)
        setTemplates([])
      } finally {
        setIsLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [])

  const handleCreate = useCallback(async () => {
    if (!projectName.trim()) {
      toast.error('Veuillez entrer un nom de projet')
      return
    }
    if (!selectedTemplate) {
      toast.error('Veuillez sélectionner un template')
      return
    }
    try {
      setIsCreating(true)
      const project = await projectService.createFromTemplate({
        name: projectName.trim(),
        templateId: selectedTemplate.id,
        ownerId: user?.id
      })
      toast.success('Projet créé avec succès !')
      navigate(`/vibe/projects/${project.id}/edit`)
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la création')
    } finally {
      setIsCreating(false)
    }
  }, [projectName, selectedTemplate, user, navigate])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Créer depuis un template</h1>
            <p className="text-sm text-gray-500">Choisissez un template pour démarrer rapidement</p>
          </div>
        </div>

        <Card className="p-4 mb-4">
          <label className="block text-sm font-medium mb-2">Nom du projet</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="Mon super projet"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Card>

        <div className="mb-4">
          <h2 className="text-sm font-semibold mb-3">Choisir un template</h2>
          {isLoadingTemplates ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun template disponible</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {templates.map(template => (
                <Card
                  key={template.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Wand2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={handleCreate}
          disabled={isCreating || !projectName.trim() || !selectedTemplate}
          className="w-full"
        >
          {isCreating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création en cours…</>
          ) : (
            'Créer le projet'
          )}
        </Button>
      </div>
    </div>
  )
}

CreateProjectTemplate.propTypes = {};

export default CreateProjectTemplate
