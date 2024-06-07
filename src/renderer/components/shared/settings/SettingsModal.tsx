import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FiSettings } from "react-icons/fi"

export const SettingsModal = () => {
  return (
    <Dialog>
      <DialogTrigger>
        <FiSettings className="text-xl ml-2"/>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lorem ipsusm?</DialogTitle>
          <DialogDescription>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quos blanditiis tenetur
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>

  )
}
