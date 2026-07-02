import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { 
  DtfImage, 
  DtfSheetParams, 
  DtfPackResult, 
  DtfSheetResult, 
  DtfPackedItem 
} from '../types/dtf';
import { 
  cmToPx, 
  pxToCm, 
  packDtfItems, 
  renderSheetToCanvas, 
  formatCurrentDate,
  MAX_CANVAS_SLICE_HEIGHT_CM 
} from '../utils/dtfPacker';
import { canvasToTiffBlob } from '../utils/canvasToTiff';
import { auth } from '../lib/firebase';
import { 
  Upload, 
  Trash2, 
  Plus, 
  Minus, 
  Download, 
  Sparkles, 
  Scissors, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  ChevronRight, 
  Image as ImageIcon,
  Cpu,
  RefreshCw,
  Maximize2,
  Minimize2,
  FileCode,
  Info,
  Calculator,
  Sliders,
  Eye,
  Settings
} from 'lucide-react';

const DEFAULT_DTF_PARAMS: DtfSheetParams = {
  jobName: 'Trabalho_DTF',
  widthCm: 56,
  heightCm: 100, // 1 Meter
  spacingMm: 5,  // 5mm default
  marginMm: 10,  // 10mm (1cm) default
  autoNesting: true,
  autoHeight: true,
  allowRotation: false
};

export default function DtfNestingTool() {
  const [params, setParams] = useState<DtfSheetParams>(DEFAULT_DTF_PARAMS);
  const [uploadedImages, setUploadedImages] = useState<DtfImage[]>([]);
  const [packResult, setPackResult] = useState<DtfPackResult | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [isAssembling, setIsAssembling] = useState<boolean>(false);
  const [assemblyProgress, setAssemblyProgress] = useState<string>('');
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [showAssemblySuccess, setShowAssemblySuccess] = useState<boolean>(false);
  const [pricePerMeter, setPricePerMeter] = useState<number>(45);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'tiff'>('png');
  const [proportionModal, setProportionModal] = useState<{
    isOpen: boolean;
    imgId: string;
    name: string;
    url: string;
    aspectRatio: number;
    printWidthCm: number;
    printHeightCm: number;
    isRatioLocked: boolean;
    applyToAll: boolean;
  } | null>(null);

  // States for advanced White Choke & Halftone simulator for TIF files
  const [viewTab, setViewTab] = useState<'nesting' | 'choke'>('nesting');
  const [chokeFineLines, setChokeFineLines] = useState<number>(0.8);
  const [chokeSolid, setChokeSolid] = useState<number>(1.8);
  const [whiteDensity, setWhiteDensity] = useState<number>(100);
  const [simulateMisalignment, setSimulateMisalignment] = useState<number>(0.4);
  const [activeLayer, setActiveLayer] = useState<'both' | 'cmyk' | 'white'>('both');
  const [simulateBg, setSimulateBg] = useState<'black' | 'colored' | 'white'>('black');

  // Temporary states for sliders before clicking Apply
  const [tempChokeFineLines, setTempChokeFineLines] = useState<number>(0.8);
  const [tempChokeSolid, setTempChokeSolid] = useState<number>(1.8);
  const [tempWhiteDensity, setTempWhiteDensity] = useState<number>(100);
  const [tempSimulateMisalignment, setTempSimulateMisalignment] = useState<number>(0.4);
  const [showAppliedToast, setShowAppliedToast] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Screen/Print Protection states
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('Membro Comunidade DTF');
  const [isScreenProtected, setIsScreenProtected] = useState<boolean>(false);

  useEffect(() => {
    // Get logged-in user email for personalized watermark
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email) {
        setCurrentUserEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Anti-Print, Screenshot Blur, and Right-click context protection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser print command (Ctrl+P or Cmd+P)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        alert('⚠️ PROTEÇÃO ATIVA: A impressão direta de tela foi desativada para proteger os layouts e a propriedade intelectual da estamparia. Utilize os botões oficiais na barra lateral para gerar e exportar arquivos prontos (PNG, PDF ou TIFF).');
      }

      // Detect PrintScreen shortcut triggers (blur elements briefly)
      if (e.key === 'PrintScreen' || e.key === 'PrtScn') {
        setIsScreenProtected(true);
        setTimeout(() => setIsScreenProtected(false), 2000);
        alert('⚠️ CÓPIA DE TELA BLOQUEADA: Captura de tela direta não permitida.');
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('copy', handleCopy);

    // Dynamic Blur Protection on focus-loss (intercepts screenshots/tab switching)
    const handleBlur = () => {
      setIsScreenProtected(true);
    };

    const handleFocus = () => {
      setIsScreenProtected(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Trigger nesting automatically whenever params or uploadedImages list changes
  useEffect(() => {
    if (uploadedImages.length > 0) {
      const result = packDtfItems(uploadedImages, params);
      setPackResult(result);
    } else {
      setPackResult(null);
    }
  }, [uploadedImages, params]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // File Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const [isWidthManual, setIsWidthManual] = useState<boolean>(false);

  const handleFiles = async (files: File[]) => {
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/tif', 'application/pdf'];
    const validFiles = files.filter(f => supportedTypes.includes(f.type) || f.name.toLowerCase().endsWith('.tiff') || f.name.toLowerCase().endsWith('.tif') || f.name.toLowerCase().endsWith('.pdf'));

    if (validFiles.length === 0) {
      alert('Por favor, envie arquivos válidos (PNG, JPG, TIFF ou PDF).');
      return;
    }

    for (const file of validFiles) {
      try {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrls(prev => [...prev, objectUrl]);

        // Identify file format based on mime-type and extension
        let format = 'PNG';
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          format = 'PDF';
        } else if (file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tiff') || file.name.toLowerCase().endsWith('.tif')) {
          format = 'TIFF';
        } else if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
          format = 'JPG';
        } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
          format = 'PNG';
        } else {
          format = file.name.split('.').pop()?.toUpperCase() || 'PNG';
        }

        // If it's a PDF, we mock dimensions or use a default since Canvas doesn't render PDF client-side without pdf.js
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const newDtfImg: DtfImage = {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', // Beautiful modern sample vector representation
            widthPx: 1200,
            heightPx: 1200,
            aspectRatio: 1.0,
            printWidthCm: 15,
            printHeightCm: 15,
            quantity: 1,
            file,
            format,
            isRatioLocked: true
          };
          setUploadedImages(prev => [...prev, newDtfImg]);
          continue;
        }

        // Get actual dimensions
        const img = new Image();
        img.onload = () => {
          const widthPx = img.width;
          const heightPx = img.height;
          const aspectRatio = widthPx / heightPx;
          
          // Default print width: 15cm or bound to the film width
          const printWidthCm = Math.min(15, params.widthCm - 2);
          const printHeightCm = parseFloat((printWidthCm / aspectRatio).toFixed(1));

          const newDtfImg: DtfImage = {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            url: objectUrl,
            widthPx,
            heightPx,
            aspectRatio,
            printWidthCm,
            printHeightCm,
            quantity: 1,
            file,
            format,
            isRatioLocked: true
          };
          setUploadedImages(prev => [...prev, newDtfImg]);
        };
        img.src = objectUrl;
      } catch (err) {
        console.error('Error loading file:', err);
      }
    }
  };

  const removeImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  // Update print properties (Width and Height)
  const updateImagePrintWidth = (id: string, widthCm: number) => {
    setUploadedImages(prev => prev.map(img => {
      if (img.id === id) {
        const newWidth = Math.max(1, Math.min(widthCm, params.widthCm));
        let newHeight = img.printHeightCm;
        if (img.isRatioLocked !== false) {
          newHeight = parseFloat((newWidth / img.aspectRatio).toFixed(1));
        }
        return {
          ...img,
          printWidthCm: newWidth,
          printHeightCm: newHeight
        };
      }
      return img;
    }));
  };

  const updateImagePrintHeight = (id: string, heightCm: number) => {
    setUploadedImages(prev => prev.map(img => {
      if (img.id === id) {
        const newHeight = Math.max(1, heightCm);
        let newWidth = img.printWidthCm;
        if (img.isRatioLocked !== false) {
          newWidth = parseFloat((newHeight * img.aspectRatio).toFixed(1));
          newWidth = Math.max(1, Math.min(newWidth, params.widthCm));
        }
        return {
          ...img,
          printWidthCm: newWidth,
          printHeightCm: newHeight
        };
      }
      return img;
    }));
  };

  const toggleImageRatioLock = (id: string) => {
    setUploadedImages(prev => prev.map(img => {
      if (img.id === id) {
        const currentLocked = img.isRatioLocked !== false;
        return {
          ...img,
          isRatioLocked: !currentLocked
        };
      }
      return img;
    }));
  };

  const updateImageQuantity = (id: string, qty: number) => {
    setUploadedImages(prev => prev.map(img => {
      if (img.id === id) {
        return {
          ...img,
          quantity: Math.max(1, qty)
        };
      }
      return img;
    }));
  };

  // Adjust Height Handlers
  const incrementHeight = () => {
    setParams(prev => ({
      ...prev,
      heightCm: Math.min(1000, prev.heightCm + 10)
    }));
  };

  const decrementHeight = () => {
    setParams(prev => ({
      ...prev,
      heightCm: Math.max(100, prev.heightCm - 10)
    }));
  };

  const handleHeightInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 100;
    setParams(prev => ({
      ...prev,
      heightCm: Math.max(100, Math.min(1000, val))
    }));
  };

  const handleJobNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const safeName = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_');
    setParams(prev => ({
      ...prev,
      jobName: safeName || 'Trabalho_DTF'
    }));
  };

  // Primary Assembly Trigger & High-Resolution Downloads
  const handleAssembleAndDownload = async () => {
    if (!packResult || packResult.sheets.length === 0) {
      alert('Por favor, envie estampas antes de montar as folhas.');
      return;
    }

    setIsAssembling(true);
    setShowAssemblySuccess(false);

    try {
      const formattedDate = formatCurrentDate();
      
      // Prepare the list of virtual sheets to render (sliced if height > 250cm to prevent browser crash)
      const sheetsToRender: DtfSheetResult[] = [];
      
      packResult.sheets.forEach(sheet => {
        if (sheet.heightCm > MAX_CANVAS_SLICE_HEIGHT_CM) {
          const numSlices = Math.ceil(sheet.heightCm / MAX_CANVAS_SLICE_HEIGHT_CM);
          for (let s = 0; s < numSlices; s++) {
            const sliceStart = s * MAX_CANVAS_SLICE_HEIGHT_CM;
            const sliceEnd = Math.min(sheet.heightCm, (s + 1) * MAX_CANVAS_SLICE_HEIGHT_CM);
            const sliceHeight = sliceEnd - sliceStart;
            
            // Filter and adjust items for this slice
            const sliceItems = sheet.items
              .filter(item => {
                const itemCenterY = item.yCm + item.heightCm / 2;
                return itemCenterY >= sliceStart && itemCenterY < sliceEnd;
              })
              .map(item => ({
                ...item,
                yCm: parseFloat((item.yCm - sliceStart).toFixed(2)),
                sheetIndex: s
              }));
              
            sheetsToRender.push({
              sheetIndex: s,
              widthCm: sheet.widthCm,
              heightCm: sliceHeight,
              items: sliceItems,
              efficiency: sheet.efficiency
            });
          }
        } else {
          sheetsToRender.push(sheet);
        }
      });

      const totalSlices = sheetsToRender.length;
      const totalHeightRequired = sheetsToRender.reduce((sum, s) => sum + s.heightCm, 0);

      // Determine if we should ZIP the files
      // "se for até 2 metros de arquivo ser em png (ou pdf), apartir disso de muitos arquivos ser zipado todo arquivo"
      const shouldZip = totalHeightRequired > 200 || totalSlices > 1;

      if (shouldZip) {
        setAssemblyProgress(
          `Renderizando e preparando o arquivo compactado ZIP com ${totalSlices} folhas...`
        );
        const zip = new JSZip();

        for (let i = 0; i < totalSlices; i++) {
          const sheet = sheetsToRender[i];
          const sliceNum = i + 1;
          
          setAssemblyProgress(
            `Renderizando Folha ${sliceNum} de ${totalSlices} em 300 DPI...`
          );

          const rawCanvas = await renderSheetToCanvas(sheet, params, false);
          const dataUrl = rawCanvas.toDataURL('image/png');
          
          let fileBaseName = `${params.jobName}_${params.widthCm}x${Math.round(sheet.heightCm)}cm_${formattedDate}`;
          if (totalSlices > 1) {
            fileBaseName += `_Parte${sliceNum}`;
          }

          if (exportFormat === 'pdf') {
            const doc = new jsPDF({
              orientation: sheet.widthCm > sheet.heightCm ? 'landscape' : 'portrait',
              unit: 'cm',
              format: [sheet.widthCm, sheet.heightCm]
            });
            doc.addImage(dataUrl, 'PNG', 0, 0, sheet.widthCm, sheet.heightCm, undefined, 'FAST');
            const pdfBlob = doc.output('blob');
            zip.file(`${fileBaseName}.pdf`, pdfBlob);
          } else if (exportFormat === 'tiff') {
            setAssemblyProgress(`Convertendo Folha ${sliceNum} de ${totalSlices} para TIFF de 300 DPI...`);
            const tiffBlob = await canvasToTiffBlob(rawCanvas);
            zip.file(`${fileBaseName}.tif`, tiffBlob);
            
            // Generate the config text file for each sheet
            const configText = `CONFIGURAÇÕES DE IMPRESSÃO DTF E CALIBRAGEM TIFF:
Data: ${formattedDate}
Trabalho: ${params.jobName} (Folha ${sliceNum})
Tamanho do Arquivo: ${params.widthCm}x${Math.round(sheet.heightCm)}cm (300 DPI)

PARÂMETROS DE BRANCO E RETRAÇÃO (WHITE CHOKE) ATIVOS NO MOMENTO DA EXPORTAÇÃO:
- Retração de Traços Finos / Letras: ${chokeFineLines.toFixed(1)} px
- Retração de Áreas Sólidas / Cheias: ${chokeSolid.toFixed(1)} px
- Canal Spot "White" (Densidade/Carga de Tinta Branca): ${whiteDensity}%
- Compensação de Desalinhamento Físico: ${simulateMisalignment.toFixed(1)} px

INSTRUÇÕES DO OPERADOR DA PLOTTER:
1. Abra este arquivo no Photoshop ou importe diretamente no seu software RIP (AcroRIP, Cadlink, etc.).
2. O arquivo TIFF de 300 DPI possui o canal alfa preservado para identificação transparente automática.
3. Configure o RIP para respeitar a calibragem de retração e aplicar ${whiteDensity}% de densidade no canal de branco.`;
            zip.file(`${fileBaseName}_parametros_dtf.txt`, new Blob([configText], { type: 'text/plain;charset=utf-8' }));
          } else {
            const blob = await (await fetch(dataUrl)).blob();
            zip.file(`${fileBaseName}.png`, blob);
          }

          // Prevent tab freeze
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        setAssemblyProgress('Criando arquivo compactado ZIP...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.download = `${params.jobName}_Lote_DTF_${formattedDate}.zip`;
        link.href = URL.createObjectURL(zipBlob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else {
        // Only 1 sheet, <= 2 meters. Download directly.
        const sheet = sheetsToRender[0];
        
        setAssemblyProgress('Renderizando folha única em 300 DPI...');
        const rawCanvas = await renderSheetToCanvas(sheet, params, false);
        const dataUrl = rawCanvas.toDataURL('image/png');
        
        const fileBaseName = `${params.jobName}_${params.widthCm}x${Math.round(sheet.heightCm)}cm_${formattedDate}`;

        if (exportFormat === 'pdf') {
          setAssemblyProgress('Gerando arquivo PDF...');
          const doc = new jsPDF({
            orientation: sheet.widthCm > sheet.heightCm ? 'landscape' : 'portrait',
            unit: 'cm',
            format: [sheet.widthCm, sheet.heightCm]
          });
          doc.addImage(dataUrl, 'PNG', 0, 0, sheet.widthCm, sheet.heightCm, undefined, 'FAST');
          doc.save(`${fileBaseName}.pdf`);
        } else if (exportFormat === 'tiff') {
          setAssemblyProgress('Convertendo arquivo para formato TIFF de 300 DPI...');
          const tiffBlob = await canvasToTiffBlob(rawCanvas);
          
          // Download TIFF
          const link = document.createElement('a');
          link.download = `${fileBaseName}.tif`;
          const tiffUrl = URL.createObjectURL(tiffBlob);
          link.href = tiffUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Download companion parameters file
          setAssemblyProgress('Salvando parâmetros de retração e branco...');
          const configText = `CONFIGURAÇÕES DE IMPRESSÃO DTF E CALIBRAGEM TIFF:
Data: ${formattedDate}
Trabalho: ${params.jobName}
Tamanho do Arquivo: ${params.widthCm}x${Math.round(sheet.heightCm)}cm (300 DPI)

PARÂMETROS DE BRANCO E RETRAÇÃO (WHITE CHOKE) ATIVOS NO MOMENTO DA EXPORTAÇÃO:
- Retração de Traços Finos / Letras: ${chokeFineLines.toFixed(1)} px
- Retração de Áreas Sólidas / Cheias: ${chokeSolid.toFixed(1)} px
- Canal Spot "White" (Densidade/Carga de Tinta Branca): ${whiteDensity}%
- Compensação de Desalinhamento Físico: ${simulateMisalignment.toFixed(1)} px

INSTRUÇÕES DO OPERADOR DA PLOTTER:
1. Abra este arquivo no Photoshop ou importe diretamente no seu software RIP (AcroRIP, Cadlink, etc.).
2. O arquivo TIFF de 300 DPI possui o canal alfa preservado para identificação transparente automática.
3. Configure o RIP para respeitar a calibragem de retração e aplicar ${whiteDensity}% de densidade no canal de branco.`;
          
          const textBlob = new Blob([configText], { type: 'text/plain;charset=utf-8' });
          const txtLink = document.createElement('a');
          txtLink.download = `${fileBaseName}_parametros_dtf.txt`;
          const textUrl = URL.createObjectURL(textBlob);
          txtLink.href = textUrl;
          document.body.appendChild(txtLink);
          txtLink.click();
          document.body.removeChild(txtLink);

          // Cleanup URLs after a timeout
          setTimeout(() => {
            URL.revokeObjectURL(tiffUrl);
            URL.revokeObjectURL(textUrl);
          }, 10000);
        } else {
          setAssemblyProgress('Salvando imagem PNG...');
          const link = document.createElement('a');
          link.download = `${fileBaseName}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }

      setAssemblyProgress('Montagem concluída! Arquivos salvos com sucesso.');
      setShowAssemblySuccess(true);
    } catch (err) {
      console.error('Error assembling DTF sheets:', err);
      alert('Ocorreu um erro ao renderizar em 300 DPI. Verifique o tamanho das imagens.');
    } finally {
      setIsAssembling(false);
    }
  };

  // Load sample prints for quick test
  const loadSampleDtf = () => {
    const samples = [
      {
        name: 'Estampa_Cyberpunk_Neon.png',
        url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=80',
        wPx: 800,
        hPx: 1000,
        printW: 18,
        qty: 3
      },
      {
        name: 'Logo_Vintage_Estamparia.png',
        url: 'https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?auto=format&fit=crop&w=400&q=80',
        wPx: 900,
        hPx: 900,
        printW: 12,
        qty: 5
      },
      {
        name: 'Caveira_Rock_Vector.png',
        url: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=400&q=80',
        wPx: 600,
        hPx: 800,
        printW: 14,
        qty: 4
      }
    ];

    const loaded: DtfImage[] = samples.map((sample, idx) => {
      const aspect = sample.wPx / sample.hPx;
      return {
        id: `sample_${idx}_${Date.now()}`,
        name: sample.name,
        url: sample.url,
        widthPx: sample.wPx,
        heightPx: sample.hPx,
        aspectRatio: aspect,
        printWidthCm: sample.printW,
        printHeightCm: parseFloat((sample.printW / aspect).toFixed(1)),
        quantity: sample.qty,
        file: new File([], sample.name),
        format: 'PNG',
        isRatioLocked: true
      };
    });

    setUploadedImages(prev => [...prev, ...loaded]);
  };

  // Slices / Sheets display calculation
  const totalDtfHeightRequired = packResult 
    ? packResult.sheets.reduce((sum, s) => sum + s.heightCm, 0)
    : 0;

  const totalFilesCount = uploadedImages.reduce((sum, img) => sum + img.quantity, 0);

  const totalRequestedArea = uploadedImages.reduce((sum, img) => sum + (img.printWidthCm * img.printHeightCm * img.quantity), 0);
  const totalRollCost = (totalDtfHeightRequired / 100) * pricePerMeter;

  const getItemCosts = (img: DtfImage) => {
    if (totalRequestedArea === 0) return { unitCost: 0, totalCost: 0 };
    const area = img.printWidthCm * img.printHeightCm;
    const unitCost = (area / totalRequestedArea) * totalRollCost;
    return {
      unitCost,
      totalCost: unitCost * img.quantity
    };
  };

  return (
    <div id="dtf-nesting-root" className={`flex-1 bg-slate-900 text-slate-100 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden transition-all duration-300 ${isScreenProtected ? 'screenshot-blur' : ''}`}>
      
      {/* Sidebar Controls - Custom styled in Deep blue/slate dark theme */}
      <aside className="w-full md:w-80 bg-[#141E33] border-r border-slate-800 flex flex-col justify-between shrink-0 overflow-y-auto">
        <div className="p-5 flex flex-col gap-6">
          
          {/* Header of Sidebar */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-cyan-400">Parâmetros DTF</h2>
            </div>
            <p className="text-[11px] text-slate-400">Defina o material do rolo e o padrão do lote.</p>
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col gap-5">
            {/* Name/Job Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">Nome do Trabalho / Cliente</label>
              <input
                type="text"
                value={params.jobName}
                onChange={handleJobNameChange}
                placeholder="Ex: Cliente_XP_Estampas"
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-cyan-500 font-bold transition-all"
              />
            </div>

            {/* Width Selector Button Grid (28cm, 56cm, and Custom/Manual option) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">Largura do Filme</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsWidthManual(false);
                    setParams(prev => ({ ...prev, widthCm: 28 }));
                  }}
                  className={`py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    !isWidthManual && params.widthCm === 28
                      ? 'bg-cyan-500 text-slate-950 shadow-xs font-black'
                      : 'text-slate-400 hover:text-slate-300 font-bold'
                  }`}
                >
                  28 cm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsWidthManual(false);
                    setParams(prev => ({ ...prev, widthCm: 56 }));
                  }}
                  className={`py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    !isWidthManual && params.widthCm === 56
                      ? 'bg-cyan-500 text-slate-950 shadow-xs font-black'
                      : 'text-slate-400 hover:text-slate-300 font-bold'
                  }`}
                >
                  56 cm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsWidthManual(true);
                  }}
                  className={`py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    isWidthManual
                      ? 'bg-cyan-500 text-slate-950 shadow-xs font-black'
                      : 'text-slate-400 hover:text-slate-300 font-bold'
                  }`}
                >
                  Manual
                </button>
              </div>

              {/* Render manual width input if manual mode is enabled */}
              {isWidthManual && (
                <div className="flex items-center gap-1.5 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-1.5 mt-1 animate-fadeIn">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Largura:</span>
                  <input
                    type="number"
                    value={params.widthCm}
                    min={10}
                    max={120}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 10;
                      setParams(prev => ({ ...prev, widthCm: Math.max(10, Math.min(120, val)) }));
                    }}
                    className="flex-1 bg-transparent text-xs text-white text-right font-bold pr-1 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-bold font-mono">cm</span>
                </div>
              )}
              <span className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                {isWidthManual 
                  ? 'Digite a largura manual de sua bobina/rolo de filme (mín. 10cm, máx. 120cm).' 
                  : 'Larguras padrões de plotter DTF industriais e portáteis.'
                }
              </span>
            </div>

            {/* Height Selector with Dynamic / Manual Option */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">Comprimento do Rolo</label>
                
                {/* Auto Height Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setParams(prev => ({ ...prev, autoHeight: !prev.autoHeight }))}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 cursor-pointer hover:bg-cyan-500/20 transition-all"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {params.autoHeight ? 'Automático' : 'Manual'}
                </button>
              </div>

              {params.autoHeight ? (
                /* Auto calculated height presentation */
                <div className="flex items-center justify-between bg-cyan-500/5 border border-cyan-500/25 rounded-xl px-4 py-3 animate-fadeIn">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">Metragem Calculada:</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">Expande dinamicamente</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-white font-mono">
                      {packResult && packResult.sheets.length > 0 ? packResult.sheets[0].heightCm : 0}
                    </span>
                    <span className="text-xs text-slate-500 font-bold ml-1 font-mono">cm</span>
                  </div>
                </div>
              ) : (
                /* Manual adjustment buttons and numerical field */
                <div className="flex items-center gap-1 bg-slate-950/50 border border-slate-800 rounded-xl p-1 animate-fadeIn">
                  <button
                    type="button"
                    onClick={decrementHeight}
                    className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={params.heightCm}
                    onChange={handleHeightInputChange}
                    min={100}
                    max={1000}
                    className="flex-1 bg-transparent text-center text-xs font-mono font-bold text-white focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-bold pr-2">cm</span>
                  <button
                    type="button"
                    onClick={incrementHeight}
                    className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {!params.autoHeight && (
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-1">
                  <span>Mín: 1m (100cm)</span>
                  <span>Máx: 10m (1000cm)</span>
                </div>
              )}
            </div>

            {/* Smart Nesting Toggle */}
            <div className="flex items-center justify-between bg-slate-950/30 border border-slate-800/60 p-3 rounded-xl">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">Encaixe Inteligente</span>
                <span className="text-[9px] text-slate-500">Auto-Nesting Algorítmico</span>
              </div>
              <button
                type="button"
                onClick={() => setParams(prev => ({ ...prev, autoNesting: !prev.autoNesting }))}
                className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-hidden cursor-pointer ${
                  params.autoNesting ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
                    params.autoNesting ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Rotation Control Toggle */}
            <div className="flex items-center justify-between bg-slate-950/30 border border-slate-800/60 p-3 rounded-xl">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">Giro Automático (90°)</span>
                <span className="text-[9px] text-slate-500">Permitir rotacionar estampas</span>
              </div>
              <button
                type="button"
                onClick={() => setParams(prev => ({ ...prev, allowRotation: !prev.allowRotation }))}
                className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-hidden cursor-pointer ${
                  params.allowRotation ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
                    params.allowRotation ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Formato de Exportação Selector */}
            <div className="flex flex-col gap-2 bg-slate-950/30 border border-slate-800/60 p-3 rounded-xl">
              <span className="text-xs font-bold text-slate-300">Formato de Exportação</span>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setExportFormat('png')}
                  className={`py-1.5 px-2 rounded-md text-xs font-black transition-all duration-150 cursor-pointer text-center ${
                    exportFormat === 'png'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10 font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('pdf')}
                  className={`py-1.5 px-2 rounded-md text-xs font-black transition-all duration-150 cursor-pointer text-center ${
                    exportFormat === 'pdf'
                      ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/10 font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('tiff')}
                  className={`py-1.5 px-2 rounded-md text-xs font-black transition-all duration-150 cursor-pointer text-center ${
                    exportFormat === 'tiff'
                      ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/10 font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  TIFF (.tif)
                </button>
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">
                {exportFormat === 'pdf' 
                  ? 'Exporta o rolo montado em PDF em escala real, com fundo transparente preservado.' 
                  : exportFormat === 'tiff'
                    ? 'Exporta em formato TIFF de 300 DPI, incluindo calibragem de Spot White e retração.'
                    : 'Exporta o rolo montado em PNG transparente com resolução profissional de 300 DPI.'}
              </p>
              <div className="mt-1 border-t border-slate-800/60 pt-1.5 text-[9px] text-slate-400 leading-tight flex items-start gap-1">
                <Info className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Lotes com mais de 2 metros de comprimento ou com múltiplas folhas serão gerados e baixados automaticamente como um arquivo <strong>ZIP</strong>.
                </span>
              </div>
            </div>

            {/* Spacing & Padding detailed settings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400">Espaço entre artes</span>
                <select
                  value={params.spacingMm}
                  onChange={(e) => setParams(prev => ({ ...prev, spacingMm: parseInt(e.target.value) || 2 }))}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 font-mono font-bold focus:outline-hidden"
                >
                  <option value={2}>2 mm</option>
                  <option value={5}>5 mm</option>
                  <option value={10}>10 mm</option>
                  <option value={15}>15 mm</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400">Margem da folha</span>
                <select
                  value={params.marginMm}
                  onChange={(e) => setParams(prev => ({ ...prev, marginMm: parseInt(e.target.value) || 5 }))}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 font-mono font-bold focus:outline-hidden"
                >
                  <option value={5}>5 mm</option>
                  <option value={10}>10 mm (1cm)</option>
                  <option value={15}>15 mm</option>
                  <option value={20}>20 mm (2cm)</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* Dynamic Canvas Slicing prevention warning */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/20 flex flex-col gap-4">
          {params.heightCm > MAX_CANVAS_SLICE_HEIGHT_CM && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-left">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Limite de Memória Evitado</span>
                <p className="text-[9px] text-slate-400 leading-normal">
                  Rolo maior que {MAX_CANVAS_SLICE_HEIGHT_CM}cm. O sistema fatiará o rolo automaticamente em {Math.ceil(params.heightCm / MAX_CANVAS_SLICE_HEIGHT_CM)} arquivos separados de alta resolução (300 DPI) para evitar travamentos no seu navegador.
                </p>
              </div>
            </div>
          )}

          {/* Core Action Button */}
          <button
            type="button"
            onClick={handleAssembleAndDownload}
            disabled={isAssembling || uploadedImages.length === 0}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-black text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            {isAssembling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                PROCESSANDO...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                MONTAR FOLHAS DTF
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 bg-slate-950 flex flex-col h-full overflow-hidden">
        
        {/* Dynamic Alert of Status or Rendering progress */}
        {(isAssembling || showAssemblySuccess) && (
          <div className={`px-6 py-3.5 text-xs font-bold border-b transition-all flex items-center justify-between ${
            showAssemblySuccess 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
          }`}>
            <div className="flex items-center gap-2.5">
              {showAssemblySuccess ? (
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              ) : (
                <RefreshCw className="w-4.5 h-4.5 text-cyan-400 animate-spin shrink-0" />
              )}
              <span>{isAssembling ? assemblyProgress : 'Lote montado e baixado! Verifique sua pasta de downloads.'}</span>
            </div>
            {showAssemblySuccess && (
              <button 
                onClick={() => setShowAssemblySuccess(false)}
                className="text-[10px] hover:underline uppercase font-bold tracking-wider opacity-85"
              >
                Fechar
              </button>
            )}
          </div>
        )}

        {/* Top bar indicators */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400">
              Estampas: <strong className="text-white font-mono">{uploadedImages.length}</strong>
            </span>
            <div className="w-[1px] h-4 bg-slate-800"></div>
            <span className="text-xs font-bold text-slate-400">
              Total de Cópias: <strong className="text-white font-mono">{totalFilesCount}</strong>
            </span>
            <div className="w-[1px] h-4 bg-slate-800"></div>
            <span className="text-xs font-bold text-slate-400">
              Encaixados: <strong className="text-cyan-400 font-mono">
                {packResult ? `${packResult.totalItemsPacked} de ${packResult.totalItemsRequested}` : '0'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadSampleDtf}
              className="bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/35 hover:border-indigo-500/55 text-indigo-300 font-black text-[11px] px-3.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Carregar Estampas de Demonstração
            </button>
            {uploadedImages.length > 0 && (
              <button
                onClick={() => {
                  setUploadedImages([]);
                  setPackResult(null);
                }}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/45 text-rose-400 font-black text-[11px] px-3.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Tudo
              </button>
            )}
          </div>
        </div>

        {/* Workspace Split Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Grid: Upload zone & Prints detail list */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-slate-800">
            
            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-3 ${
                dragActive 
                  ? 'border-cyan-500 bg-cyan-500/5' 
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.tiff,.tif,.pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/5 text-cyan-400 flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-200">Arraste ou selecione suas estampas</h4>
                <p className="text-[11px] text-slate-400 mt-1">Suporta arquivos de alta definição PNG, JPG, TIFF ou PDF.</p>
              </div>
            </div>

            {/* List/Grid of uploaded items */}
            {uploadedImages.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Estampas a serem impressas</h3>
                  <span className="text-[10px] text-slate-500 font-bold">Defina o tamanho de impressão desejado</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {uploadedImages.map((img) => (
                    <div 
                      key={img.id}
                      className="bg-[#141E33] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden group shadow-xs"
                    >
                      <div className="flex gap-3">
                        {/* Preview thumbnail */}
                        <div 
                          onClick={() => setProportionModal({
                            isOpen: true,
                            imgId: img.id,
                            name: img.name,
                            url: img.url,
                            aspectRatio: img.aspectRatio,
                            printWidthCm: img.printWidthCm,
                            printHeightCm: img.printHeightCm,
                            isRatioLocked: img.isRatioLocked !== false,
                            applyToAll: false
                          })}
                          className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/5 shrink-0 overflow-hidden flex items-center justify-center p-1.5 relative cursor-pointer transition-all duration-200 group/thumb"
                          title="Clique para ajustar proporção manual avançada"
                        >
                          <img 
                            src={img.url} 
                            alt={img.name} 
                            className="max-w-full max-h-full object-contain group-hover/thumb:scale-105 transition-transform duration-200"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[7px] font-black uppercase text-cyan-400 bg-slate-950/80 px-1 py-0.5 rounded-sm">AJUSTAR</span>
                          </div>
                        </div>

                        {/* File details with format identifier */}
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                              img.format === 'PNG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              img.format === 'JPG' || img.format === 'JPEG' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              img.format === 'TIFF' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            } border`}>
                              {img.format || 'PNG'}
                            </span>
                            <span className="text-xs font-black text-slate-200 truncate block max-w-[120px]" title={img.name}>
                              {img.name}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-slate-500 block mt-1.5">
                            Resolução: {img.widthPx}x{img.heightPx} px
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                            Original (300 DPI): {parseFloat((img.widthPx / 300 * 2.54).toFixed(1))}x{parseFloat((img.heightPx / 300 * 2.54).toFixed(1))} cm
                          </span>
                          {totalRollCost > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-slate-800/40 flex flex-col gap-0.5 font-mono text-[9px]">
                              <span className="text-slate-400">Unitário: <strong className="text-cyan-400">R$ {getItemCosts(img).unitCost.toFixed(2)}</strong></span>
                              <span className="text-slate-400">Subtotal ({img.quantity}x): <strong className="text-cyan-400 font-bold">R$ {getItemCosts(img).totalCost.toFixed(2)}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeImage(img.id)}
                          className="text-slate-500 hover:text-rose-400 absolute top-3 right-3 w-7 h-7 rounded-lg hover:bg-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Dimension and Quantity controls */}
                      <div className="flex flex-col gap-2.5 border-t border-slate-800/60 pt-3">
                        <div className="grid grid-cols-2 gap-2">
                          {/* Desired print width */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400">Largura (cm)</span>
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                              <input
                                type="number"
                                value={img.printWidthCm}
                                step={0.5}
                                min={1}
                                max={params.widthCm}
                                onChange={(e) => updateImagePrintWidth(img.id, parseFloat(e.target.value) || 1)}
                                className="w-full bg-transparent text-xs text-white font-bold text-center focus:outline-hidden"
                              />
                            </div>
                          </div>

                          {/* Desired print height (Calculated or Editable if manual) */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400">Altura (cm)</span>
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                              <input
                                type="number"
                                value={img.printHeightCm}
                                step={0.5}
                                min={0.5}
                                disabled={img.isRatioLocked !== false}
                                onChange={(e) => updateImagePrintHeight(img.id, parseFloat(e.target.value) || 1)}
                                className={`w-full bg-transparent text-xs font-bold text-center focus:outline-hidden ${
                                  img.isRatioLocked !== false ? 'text-slate-500 cursor-not-allowed' : 'text-white'
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Lock / Manual aspect ratio selector & quantity picker */}
                        <div className="grid grid-cols-2 gap-2 items-center">
                          {/* Proportion Option Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleImageRatioLock(img.id)}
                            className={`py-1.5 px-2 rounded-lg text-[9px] font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                              img.isRatioLocked !== false
                                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                                : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400 shadow-xs shadow-cyan-500/5'
                            }`}
                          >
                            {img.isRatioLocked !== false ? (
                              <>
                                <Maximize2 className="w-3 h-3 text-cyan-400 shrink-0" />
                                Proporção Ativa
                              </>
                            ) : (
                              <>
                                <Minimize2 className="w-3 h-3 text-cyan-400 shrink-0" />
                                Manual / Livre
                              </>
                            )}
                          </button>

                          {/* Quantity selector */}
                          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateImageQuantity(img.id, img.quantity - 1)}
                              className="w-6 h-6 rounded bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              value={img.quantity}
                              onChange={(e) => updateImageQuantity(img.id, parseInt(e.target.value) || 1)}
                              className="flex-1 bg-transparent text-xs text-white font-mono font-bold text-center focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => updateImageQuantity(img.id, img.quantity + 1)}
                              className="w-6 h-6 rounded bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                <ImageIcon className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                <p className="text-xs font-bold">Sua lista de estampas está vazia.</p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xs text-center leading-normal">
                  Carregue seus logotipos e artes acima para realizar o nesting inteligente e montar o rolo DTF.
                </p>
              </div>
            )}
          </div>

          {/* Right Area: Interactive Visual Board */}
          <div className="flex-1 bg-slate-950/60 p-6 flex flex-col gap-4 overflow-y-auto">
            
            {/* Header of Preview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/80 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewTab('nesting')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewTab === 'nesting'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Montagem do Rolo (Nesting)
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('choke')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewTab === 'choke'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Branco & Retração (TIFF / Halftone)
                </button>
              </div>
              
              {viewTab === 'nesting' && packResult && packResult.sheets.length > 1 && (
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                  {packResult.sheets.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedSheetIndex(index)}
                      className={`px-2.5 py-1 rounded text-[10px] font-black tracking-tight transition-colors cursor-pointer ${
                        selectedSheetIndex === index
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Folha {index + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Visual sheet board */}
            {viewTab === 'nesting' && (
              <>
                {packResult && packResult.sheets.length > 0 ? (
                  <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 py-4 animate-fadeIn">
                    
                    {/* Simulated Canvas roll preview */}
                    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 shrink-0 max-w-full">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                        <span className="text-[10px] font-mono text-slate-500 font-bold">LARGURA ÚTIL: {params.widthCm}cm</span>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10">
                          Folha {selectedSheetIndex + 1} ({packResult.sheets[selectedSheetIndex].efficiency}% Encaixada)
                        </span>
                      </div>

                      {/* Render simulated vector grid inside a scrollable sheet container to show true scale */}
                      <div className="max-h-[500px] overflow-y-auto pr-1.5 border border-slate-800 rounded-xl bg-slate-950/40 p-2 scrollbar-thin">
                        <div 
                          onContextMenu={(e) => e.preventDefault()}
                          className="bg-slate-950 border border-slate-800/80 rounded-xl relative overflow-hidden transition-all duration-300 select-none"
                          style={{
                            width: params.widthCm === 56 ? '320px' : '200px',
                            // Dynamic height to maintain physical aspect ratio
                            height: `${Math.max(200, Math.round((params.widthCm === 56 ? 320 : 200) * (packResult.sheets[selectedSheetIndex].heightCm / packResult.sheets[selectedSheetIndex].widthCm)))}px`,
                          }}
                        >
                          {/* Screenshot protective repeating watermark overlay */}
                          <div 
                            className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay opacity-30 select-none"
                            style={{
                              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='100' viewBox='0 0 160 100'><text x='10' y='50' fill='rgba(255,255,255,0.18)' font-size='6.5' font-family='sans-serif' font-weight='bold' transform='rotate(-22 80 50)'>${currentUserEmail.substring(0, 26)}</text></svg>")`,
                              backgroundRepeat: 'repeat',
                            }}
                          ></div>

                          {/* Background checkerboard grid pattern */}
                          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-35"></div>
                          
                          {/* Simulated laser margin guidelines */}
                          <div 
                            className="absolute border border-dashed border-cyan-500/25 pointer-events-none"
                            style={{
                              inset: `${params.marginMm / 10 * 3}px`
                            }}
                          ></div>

                          {/* Packed items representation */}
                          <div className="absolute inset-0 p-3">
                            {packResult.sheets[selectedSheetIndex].items.map((item, idx) => {
                              // Calculate percentage-based placement relative to sheet width/height
                              const sheetW = packResult.sheets[selectedSheetIndex].widthCm;
                              const sheetH = packResult.sheets[selectedSheetIndex].heightCm;
                              
                              const pctLeft = (item.xCm / sheetW) * 100;
                              const pctTop = (item.yCm / sheetH) * 100;
                              const pctW = (item.widthCm / sheetW) * 100;
                              const pctH = (item.heightCm / sheetH) * 100;

                              return (
                                <div
                                  key={idx}
                                  onClick={() => setProportionModal({
                                    isOpen: true,
                                    imgId: item.image.id,
                                    name: item.image.name,
                                    url: item.image.url,
                                    aspectRatio: item.image.aspectRatio,
                                    printWidthCm: item.image.printWidthCm,
                                    printHeightCm: item.image.printHeightCm,
                                    isRatioLocked: item.image.isRatioLocked !== false,
                                    applyToAll: false
                                  })}
                                  className="absolute border border-cyan-500/40 bg-cyan-500/5 rounded-sm flex items-center justify-center overflow-hidden hover:border-cyan-400 group transition-all cursor-pointer"
                                  style={{
                                    left: `${pctLeft}%`,
                                    top: `${pctTop}%`,
                                    width: `${pctW}%`,
                                    height: `${pctH}%`,
                                  }}
                                >
                                  <img 
                                    src={item.image.url} 
                                    alt="Item preview" 
                                    className={`max-w-[95%] max-h-[95%] object-contain opacity-75 group-hover:opacity-100 transition-opacity ${
                                      item.isRotated ? 'rotate-90' : ''
                                    }`}
                                    referrerPolicy="no-referrer"
                                  />
                                  
                                  {/* Hover info badge */}
                                  <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 flex flex-col justify-center items-center text-center p-1 transition-opacity select-none pointer-events-none">
                                    <span className="text-[8px] font-black text-cyan-400 block truncate max-w-full">
                                      {item.image.name}
                                    </span>
                                    <span className="text-[7px] font-mono text-slate-400 font-bold block mt-0.5">
                                      {item.widthCm}x{item.heightCm} cm
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-850 pt-2">
                        <span className="text-[10px] text-slate-500 font-mono">Comprimento do rolo: {packResult.sheets[selectedSheetIndex].heightCm}cm</span>
                        <span className="text-[10px] text-slate-500 font-mono">DPI: 300</span>
                      </div>
                    </div>

                    {/* Legend & Stats Details */}
                    <div className="flex-1 max-w-sm flex flex-col gap-4">
                      <div className="bg-[#141E33] border border-slate-800/80 rounded-2xl p-5">
                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-3">Métricas do Lote</h4>
                        <div className="space-y-3.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-medium">Área Ocupada Útil:</span>
                            <strong className="text-cyan-400">{packResult.sheets[selectedSheetIndex].efficiency}%</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-medium">Artes Encaixadas:</span>
                            <strong className="text-white">{packResult.totalItemsPacked} / {packResult.totalItemsRequested}</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-medium">Comprimento de Rolo:</span>
                            <strong className="text-cyan-400 font-mono font-black">{totalDtfHeightRequired} cm</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-medium">Largura de Rolo:</span>
                            <strong className="text-white font-mono">{params.widthCm} cm</strong>
                          </div>
                          
                          {packResult.unpackedItems.length > 0 && (
                            <div className="border-t border-slate-800 pt-3.5 mt-2">
                              <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block mb-2">Não couberam no Rolo</span>
                              <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-950/30 p-2 rounded-xl border border-rose-500/10">
                                {packResult.unpackedItems.map((ui, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-[10px] text-slate-400">
                                    <span className="truncate max-w-[140px] font-bold">{ui.image.name}</span>
                                    <strong className="text-rose-400 font-mono">+{ui.count} cópias</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Calculadora de Custos */}
                      <div className="bg-[#141E33] border border-slate-800/80 rounded-2xl p-5">
                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Calculator className="w-4 h-4 text-cyan-400" />
                          Calculadora de Custos
                        </h4>
                        <div className="space-y-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400">Preço do Metro Linear (R$)</span>
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
                              <button
                                type="button"
                                onClick={() => setPricePerMeter(p => Math.max(0, p - 5))}
                                className="w-8 h-8 rounded-md bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex items-center justify-center transition-all cursor-pointer text-xs font-bold"
                              >
                                -5
                              </button>
                              <input
                                type="number"
                                value={pricePerMeter}
                                onChange={(e) => setPricePerMeter(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="flex-1 bg-transparent text-center text-xs font-mono font-bold text-white focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => setPricePerMeter(p => p + 5)}
                                className="w-8 h-8 rounded-md bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex items-center justify-center transition-all cursor-pointer text-xs font-bold"
                              >
                                +5
                              </button>
                            </div>
                          </div>

                          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-2 font-mono text-[11px] leading-normal">
                            <div className="flex justify-between text-slate-400">
                              <span>Total de Estampas:</span>
                              <strong className="text-white">{uploadedImages.length} itens</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Total de Cópias:</span>
                              <strong className="text-white">{totalFilesCount} cópias</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Comprimento total:</span>
                              <strong className="text-white">{(totalDtfHeightRequired / 100).toFixed(2)} m</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Valor por metro:</span>
                              <strong className="text-white">R$ {pricePerMeter.toFixed(2)}</strong>
                            </div>
                            <div className="border-t border-slate-800 pt-2 flex justify-between text-xs font-black">
                              <span className="text-cyan-400 font-bold">Valor Estimado:</span>
                              <strong className="text-cyan-400 text-sm">R$ {totalRollCost.toFixed(2)}</strong>
                            </div>
                          </div>

                          {/* Individual Cost Breakdown list */}
                          {uploadedImages.length > 0 && totalRollCost > 0 && (
                            <div className="bg-slate-950/20 border border-slate-800/60 rounded-xl p-3.5 space-y-2.5">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                <span>Custos por Item</span>
                              </h5>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {uploadedImages.map((img) => {
                                  const costs = getItemCosts(img);
                                  return (
                                    <div key={img.id} className="flex flex-col gap-0.5 border-b border-slate-850 pb-1.5 last:border-0 last:pb-0 font-mono text-[10px]">
                                      <div className="flex justify-between text-slate-300 font-bold">
                                        <span className="truncate max-w-[140px]" title={img.name}>{img.name}</span>
                                        <span className="text-cyan-400 font-bold">R$ {costs.totalCost.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-[9px] text-slate-500">
                                        <span>{img.printWidthCm}x{img.printHeightCm}cm (Qtd: {img.quantity})</span>
                                        <span>Unit: R$ {costs.unitCost.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <p>
                            Para plotters de impressão DTF, garanta que suas imagens possuem fundo transparente. A ferramenta preservará o canal alfa transparente no PNG exportado.
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-24 border border-dashed border-slate-850 rounded-2xl animate-fadeIn">
                    <Layers className="w-10 h-10 text-slate-800 mb-3 animate-pulse" />
                    <p className="text-xs font-bold">Nenhum encaixe ativo no momento.</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-xs text-center leading-normal">
                      Configure as opções na sidebar e carregue suas imagens para visualizar o encaixe matemático 2D Bin Packing.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Simulador de Retração & Canais de Branco (White Choke & Halftone) */}
            {viewTab === 'choke' && (
              <div className="flex-1 flex flex-col xl:flex-row gap-6 py-2 animate-fadeIn text-left">
                {/* Lateral de Controles do Simulador */}
                <div className="w-full xl:w-80 bg-[#141E33] border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shrink-0">
                  <div>
                    <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      Calibragem de Retração & Branco
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">
                      Configure a retração do fundo de branco (White Choke) e a densidade do canal Spot White para a sua plotter DTF.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Control 1: Fine Lines */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                          1. Traços Finos / Letras
                        </span>
                        <strong className="text-cyan-400 font-mono">{tempChokeFineLines.toFixed(1)} px</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2.0"
                        step="0.1"
                        value={tempChokeFineLines}
                        onChange={(e) => setTempChokeFineLines(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <span className="text-[9px] text-slate-550 leading-normal">
                        Recomendado: <strong className="text-cyan-400">0.5px a 0.8px</strong>. Mantém o contorno legível sem desbotar o colorido.
                      </span>
                    </div>

                    {/* Control 2: Solid Areas */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                          2. Áreas Sólidas / Cheias
                        </span>
                        <strong className="text-violet-400 font-mono">{tempChokeSolid.toFixed(1)} px</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="4.0"
                        step="0.1"
                        value={tempChokeSolid}
                        onChange={(e) => setTempChokeSolid(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-violet-400"
                      />
                      <span className="text-[9px] text-slate-550 leading-normal">
                        Recomendado: <strong className="text-violet-400">1.5px a 2.5px</strong>. Encolhe mais a base branca para que não vase nas bordas em tecidos pretos.
                      </span>
                    </div>

                    {/* Control 3: Spot White Channel Density */}
                    <div className="flex flex-col gap-1.5 border-t border-slate-800/80 pt-4">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-100 animate-pulse"></span>
                          Canal Spot "White" (Densidade)
                        </span>
                        <strong className="text-slate-200 font-mono">{tempWhiteDensity}%</strong>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={tempWhiteDensity}
                        onChange={(e) => setTempWhiteDensity(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-slate-300"
                      />
                      <span className="text-[9px] text-slate-550 leading-normal">
                        Controla a carga de tinta branca depositada como base sobre o filme DTF.
                      </span>
                    </div>

                    {/* Control 4: Misalignment */}
                    <div className="border-t border-slate-800/80 pt-4 mt-1 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-rose-400 font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          Desalinhamento Físico
                        </span>
                        <strong className="text-rose-400 font-mono">{tempSimulateMisalignment.toFixed(1)} px</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2.0"
                        step="0.1"
                        value={tempSimulateMisalignment}
                        onChange={(e) => setTempSimulateMisalignment(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                      <span className="text-[9px] text-slate-550 leading-normal">
                        Simula o erro de registro físico (desvio de cabeçote) da plotter DTF para testar a vedação da retração.
                      </span>
                    </div>

                    {/* Apply Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setChokeFineLines(tempChokeFineLines);
                          setChokeSolid(tempChokeSolid);
                          setWhiteDensity(tempWhiteDensity);
                          setSimulateMisalignment(tempSimulateMisalignment);
                          setShowAppliedToast(true);
                          setTimeout(() => setShowAppliedToast(false), 2000);
                        }}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-lg transition-all duration-150 transform active:scale-[0.96] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aplicar Ajustes
                      </button>
                      {showAppliedToast && (
                        <div className="text-[10px] text-emerald-400 font-bold mt-1.5 text-center animate-pulse">
                          ✓ Ajustes aplicados ao simulador!
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-4 space-y-3.5">
                    {/* Layer Mode Selector */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modo de Camadas</span>
                      <div className="grid grid-cols-3 gap-1 bg-slate-950 p-0.5 border border-slate-850 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setActiveLayer('both')}
                          className={`py-1 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer ${
                            activeLayer === 'both' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Cores + Br.
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLayer('white')}
                          className={`py-1 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer ${
                            activeLayer === 'white' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Branco
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLayer('cmyk')}
                          className={`py-1 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer ${
                            activeLayer === 'cmyk' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Cores
                        </button>
                      </div>
                    </div>

                    {/* Background Selector */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cor do Tecido</span>
                      <div className="grid grid-cols-3 gap-1 bg-slate-950 p-0.5 border border-slate-850 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setSimulateBg('black')}
                          className={`py-1 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                            simulateBg === 'black' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-black border border-slate-700"></span>
                          Preto
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimulateBg('colored')}
                          className={`py-1 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                            simulateBg === 'colored' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          Colorido
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimulateBg('white')}
                          className={`py-1 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                            simulateBg === 'white' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-white border border-slate-300"></span>
                          Branco
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Área de Visualização Gráfica Interativa da Simulação */}
                <div className="flex-1 flex flex-col gap-5">
                  <div 
                    onContextMenu={(e) => e.preventDefault()}
                    className={`flex-1 min-h-[350px] border border-slate-800 rounded-2xl relative overflow-hidden flex flex-col items-center justify-center p-6 transition-colors duration-300 select-none ${
                    simulateBg === 'black' ? 'bg-slate-950' :
                    simulateBg === 'colored' ? 'bg-red-950/90' : 'bg-slate-200'
                  }`}>
                    {/* Screenshot protective repeating watermark overlay */}
                    <div 
                      className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay opacity-30 select-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='100' viewBox='0 0 160 100'><text x='10' y='50' fill='rgba(255,255,255,0.18)' font-size='6.5' font-family='sans-serif' font-weight='bold' transform='rotate(-22 80 50)'>${currentUserEmail.substring(0, 26)}</text></svg>")`,
                        backgroundRepeat: 'repeat',
                      }}
                    ></div>

                    {/* Background checkerboard grid pattern para simular transparência/malha do tecido */}
                    <div className={`absolute inset-0 [background-size:20px_20px] opacity-15 pointer-events-none ${
                      simulateBg === 'white' 
                        ? 'bg-[radial-gradient(#94a3b8_1px,transparent_1px)]' 
                        : 'bg-[radial-gradient(#334155_1px,transparent_1px)]'
                    }`}></div>

                    {/* Badges indicativos */}
                    <div className="absolute top-4 left-4 z-10 flex flex-col md:flex-row gap-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border tracking-wider flex items-center gap-1.5 select-none ${
                        simulateMisalignment > 0.2 && (chokeSolid < simulateMisalignment || chokeFineLines < simulateMisalignment)
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          simulateMisalignment > 0.2 && (chokeSolid < simulateMisalignment || chokeFineLines < simulateMisalignment)
                            ? 'bg-rose-400 animate-pulse'
                            : 'bg-emerald-400'
                        }`}></span>
                        {simulateMisalignment > 0.2 && (chokeSolid < simulateMisalignment || chokeFineLines < simulateMisalignment)
                          ? 'Vazamento Detectado! Ajuste a Retração.'
                          : 'Registro Perfeito! Sem bordas brancas.'
                        }
                      </span>

                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md border tracking-wider bg-cyan-500/10 border-cyan-500/30 text-cyan-400 select-none flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                        Canal Spot: White ({whiteDensity}%)
                      </span>
                    </div>

                    {/* Elementos de simulação gráfica lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-xl relative z-10">

                      {/* Elemento 1: Traços Finos */}
                      <div className="flex flex-col items-center bg-slate-900/45 border border-slate-800/40 p-4 rounded-xl backdrop-blur-xs text-center relative overflow-hidden group">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-4 block">1. Traço Pequeno / Texto</span>
                        
                        <div className="w-32 h-32 relative flex items-center justify-center bg-slate-950/60 rounded-xl border border-slate-850">
                          {/* Camada de Branco (Abaixo) */}
                          {activeLayer !== 'cmyk' && (
                            <div 
                              className="absolute transition-transform duration-200 select-none pointer-events-none flex flex-col items-center justify-center"
                              style={{
                                transform: `translate(${simulateMisalignment * 4}px, ${simulateMisalignment * 4}px) scale(${1 - (chokeFineLines * 0.08)})`,
                                opacity: (activeLayer === 'white' ? 1.0 : 0.75) * (whiteDensity / 100),
                              }}
                            >
                              <span className="text-2xl font-black text-slate-300 font-sans tracking-widest uppercase">DTF</span>
                              {/* Linhas finas de teste */}
                              <div className="h-[1px] bg-slate-300 w-16 mt-1"></div>
                              <div className="h-[2px] bg-slate-300 w-16 mt-0.5"></div>
                            </div>
                          )}

                          {/* Camada Colorida (Acima) */}
                          {activeLayer !== 'white' && (
                            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-black text-amber-400 font-sans tracking-widest uppercase">DTF</span>
                              {/* Linhas finas coloridas */}
                              <div className="h-[1px] bg-amber-400 w-16 mt-1"></div>
                              <div className="h-[2px] bg-amber-400 w-16 mt-0.5"></div>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 block mt-3">
                          Retração: <strong className="text-cyan-400">{chokeFineLines.toFixed(1)} px</strong>
                        </span>
                      </div>

                      {/* Elemento 2: Áreas Sólidas */}
                      <div className="flex flex-col items-center bg-slate-900/45 border border-slate-800/40 p-4 rounded-xl backdrop-blur-xs text-center relative overflow-hidden group">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-4 block">2. Áreas Sólidas / Cheias</span>
                        
                        <div className="w-32 h-32 relative flex items-center justify-center bg-slate-950/60 rounded-xl border border-slate-850">
                          {/* Camada de Branco (Abaixo) */}
                          {activeLayer !== 'cmyk' && (
                            <div 
                              className="absolute rounded-full bg-slate-200 transition-all duration-200 select-none pointer-events-none"
                              style={{
                                width: `${76 - (chokeSolid * 8)}px`,
                                height: `${76 - (chokeSolid * 8)}px`,
                                transform: `translate(${simulateMisalignment * 4}px, ${simulateMisalignment * 4}px)`,
                                opacity: (activeLayer === 'white' ? 1.0 : 0.8) * (whiteDensity / 100),
                              }}
                            ></div>
                          )}

                          {/* Camada Colorida (Acima) */}
                          {activeLayer !== 'white' && (
                            <div 
                              className="absolute rounded-full bg-indigo-500 pointer-events-none flex items-center justify-center font-bold text-white text-[10px]"
                              style={{
                                width: '76px',
                                height: '76px',
                              }}
                            >
                              SÓLIDO
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 block mt-3">
                          Retração: <strong className="text-violet-400">{chokeSolid.toFixed(1)} px</strong>
                        </span>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

    {/* Proportion adjustment modal overlay */}
    {proportionModal && (
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-[#141E33] border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              Ajustar Proporção Manual
            </h3>
            <button
              type="button"
              onClick={() => setProportionModal(null)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-5 flex flex-col gap-4">
            {/* Image preview and name */}
            <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
              <img 
                src={proportionModal.url} 
                alt={proportionModal.name} 
                className="w-12 h-12 object-contain bg-slate-950 rounded-lg p-1 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-black text-slate-200 block truncate" title={proportionModal.name}>
                  {proportionModal.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Proporção Original: {proportionModal.aspectRatio.toFixed(2)}</span>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400">Largura (cm)</span>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                  <input
                    type="number"
                    value={proportionModal.printWidthCm}
                    step={0.5}
                    min={1}
                    max={params.widthCm}
                    onChange={(e) => {
                      const newW = parseFloat(e.target.value) || 1;
                      let newH = proportionModal.printHeightCm;
                      if (proportionModal.isRatioLocked) {
                        newH = parseFloat((newW / proportionModal.aspectRatio).toFixed(1));
                      }
                      setProportionModal(prev => prev ? {
                        ...prev,
                        printWidthCm: newW,
                        printHeightCm: newH
                      } : null);
                    }}
                    className="w-full bg-transparent text-xs text-white font-bold text-center focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 font-bold ml-1">cm</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400">Altura (cm)</span>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                  <input
                    type="number"
                    value={proportionModal.printHeightCm}
                    step={0.5}
                    min={0.5}
                    disabled={proportionModal.isRatioLocked}
                    onChange={(e) => {
                      const newH = parseFloat(e.target.value) || 1;
                      setProportionModal(prev => prev ? {
                        ...prev,
                        printHeightCm: newH
                      } : null);
                    }}
                    className={`w-full bg-transparent text-xs font-bold text-center focus:outline-hidden ${
                      proportionModal.isRatioLocked ? 'text-slate-500 cursor-not-allowed' : 'text-white'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500 font-bold ml-1">cm</span>
                </div>
              </div>
            </div>

            {/* Aspect Ratio Toggle button */}
            <button
              type="button"
              onClick={() => {
                setProportionModal(prev => {
                  if (!prev) return null;
                  const nextLocked = !prev.isRatioLocked;
                  let nextHeight = prev.printHeightCm;
                  if (nextLocked) {
                    nextHeight = parseFloat((prev.printWidthCm / prev.aspectRatio).toFixed(1));
                  }
                  return {
                    ...prev,
                    isRatioLocked: nextLocked,
                    printHeightCm: nextHeight
                  };
                });
              }}
              className={`py-2 px-3 rounded-lg text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                proportionModal.isRatioLocked
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                  : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400 shadow-xs shadow-cyan-500/5'
              }`}
            >
              {proportionModal.isRatioLocked ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  Proporção Ativa (Travar Aspect Ratio)
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  Manual / Livre (Distorcer Imagem)
                </>
              )}
            </button>

            {/* Option to apply to all files */}
            <label className="flex items-center gap-2.5 bg-slate-950/30 border border-slate-800/50 p-3 rounded-xl cursor-pointer hover:bg-slate-950/50 transition-colors select-none">
              <input
                type="checkbox"
                checked={proportionModal.applyToAll}
                onChange={(e) => setProportionModal(prev => prev ? { ...prev, applyToAll: e.target.checked } : null)}
                className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500/30 bg-slate-950 w-4 h-4 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-200">Aplicar em todos os arquivos</span>
                <span className="text-[10px] text-slate-500">Sobrescreve as dimensões de todas as estampas carregadas</span>
              </div>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="px-5 py-4 bg-slate-950/45 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setProportionModal(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                const { imgId, printWidthCm, printHeightCm, isRatioLocked, applyToAll } = proportionModal;
                if (applyToAll) {
                  setUploadedImages(prev => prev.map(img => {
                    let finalHeight = printHeightCm;
                    if (isRatioLocked) {
                      finalHeight = parseFloat((printWidthCm / img.aspectRatio).toFixed(1));
                    }
                    return {
                      ...img,
                      printWidthCm: printWidthCm,
                      printHeightCm: finalHeight,
                      isRatioLocked: isRatioLocked
                    };
                  }));
                } else {
                  setUploadedImages(prev => prev.map(img => {
                    if (img.id === imgId) {
                      return {
                        ...img,
                        printWidthCm: printWidthCm,
                        printHeightCm: printHeightCm,
                        isRatioLocked: isRatioLocked
                      };
                    }
                    return img;
                  }));
                }
                setProportionModal(null);
              }}
              className="px-5 py-2 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/10 cursor-pointer"
            >
              Aplicar Ajustes
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
