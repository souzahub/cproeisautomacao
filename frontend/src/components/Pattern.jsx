import React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"

export function Pattern() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">abrir diálogo</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>exemplo de diálogo</DialogTitle>
          <DialogDescription>
            selecione a opção abaixo para abrir a caixa de confirmação.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AlertDialog>
            <AlertDialogTrigger render={<Button>abrir confirmação</Button>} />
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  esta ação não poderá ser desfeita. isto excluirá permanentemente o registro do sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>cancelar</AlertDialogCancel>
                <AlertDialogAction variant="danger">confirmar exclusão</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
